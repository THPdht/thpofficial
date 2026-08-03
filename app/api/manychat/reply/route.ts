/**
 * Instagram DM automation — the endpoint ManyChat calls.
 *
 * Setup (one-time):
 *   ManyChat → Automation → your flow → External Request
 *   POST https://thpofficial.com/api/manychat/reply
 *   Header: x-manychat-secret: <MANYCHAT_WEBHOOK_SECRET>
 *   Body:   subscriber_id, ig_username, first_name, message, keyword, resource_url
 *
 * This is deliberately NOT an FAQ bot. It has one job: hand over the link the
 * post promised, get an email, point at /apply, and get out of the way. It never
 * answers questions about pricing, programs or health. Anything off that path
 * escalates to Ali and the bot goes quiet for that thread.
 *
 * Claude is used for exactly one thing here: reading a free-text reply to decide
 * which of those branches it is. It never writes a word that gets sent to a user.
 * All outgoing copy is either a constant below or the campaign's own dm_copy.
 */

import Anthropic from '@anthropic-ai/sdk';
import { notifyAdmin, pushAdmin } from '@/lib/notifyAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  block,
  escapeLike,
  extractEmail,
  realValue,
  secretMatches,
  silent,
  type ManyChatAction,
  type ManyChatRequest,
  type ManyChatResponse,
} from '@/lib/manychat';

/** Claude calls per subscriber per day. A loop or a troll can't run up a bill. */
const MAX_AI_TURNS_PER_DAY = 10;

const HUMAN_TAG = 'needs-human';

/** ManyChat hangs its delayed YouTube follow-up off this tag. */
const YT_TAG = 'yt-nudge';

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://thpofficial.com';

/**
 * Every line here is sent from Ali's own Instagram account, so all of it is
 * written in his first person. Nothing refers to Ali in the third person and
 * nothing hints at automation: "Ali will get back to you" on Ali's own account
 * gives the game away in one line. The bot never claims to be a person either.
 * It simply speaks as the account and stops talking when it runs out of script.
 */
const DEFAULTS = {
  opener: "Tell me what's going on with you right now. What symptoms are you dealing with?",
  apply: "Sounds like something I can help you with. Fill this out and book your call and we'll take it from there.\n\n{link}",
  notAFit: 'Appreciate the love, seriously. Most of what I put out lives on my YouTube, go subscribe and I will see you over there.',
  holding: "Give me a bit and I'll get back to you here.",
};

type Copy = typeof DEFAULTS;

/** Fixed lines with no reason to be edited mid-campaign. */
const STATIC = {
  emailAsk: "What's the best email for you? I'll send the next step there.",
  alreadyApplied: (url: string) =>
    `You're already in the system. If you haven't finished your application you can pick it back up here:\n\n${url}`,
  client: (url: string) =>
    `You're already set up in the portal. Message me in there and I'll see it:\n\n${url}`,
};

/**
 * Put the URL where Ali wants it. He writes {link} in the copy; without it the
 * link goes on its own line at the end so a message can never lose its link.
 */
function withLink(copy: string, url: string): string {
  return copy.includes('{link}') ? copy.replace(/\{link\}/g, url) : `${copy}\n\n${url}`;
}

/** A campaign with no link must never ship a raw {link} token to a real person. */
function stripLinkToken(copy: string): string {
  return copy.replace(/\{link\}/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Handles allowed to receive replies while test mode is on. */
function isAllowedInTest(list: string | null | undefined, handle: string | null): boolean {
  if (!handle) return false;
  const allowed = (list ?? '')
    .split(/[\s,]+/)
    .map(h => h.replace(/^@/, '').trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(handle.replace(/^@/, '').trim().toLowerCase());
}

type Contact = {
  subscriber_id: string;
  ig_username: string | null;
  first_name: string | null;
  email: string | null;
  keyword: string | null;
  stage: string;
  bot_paused: boolean;
  turns_today: number;
  turns_date: string | null;
  holding_sent_at: string | null;
};

type Campaign = { keyword: string; resource_url: string; dm_copy: string; active: boolean };

type Intent = 'giving_email' | 'wants_link' | 'question' | 'not_interested' | 'other';

/** How someone answered the opener. Decides whether they get pitched at all. */
type OpenerIntent = 'symptoms' | 'optimizing' | 'not_a_fit' | 'question' | 'other';

const today = () => new Date().toISOString().slice(0, 10);

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get('x-manychat-secret'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ManyChatRequest;
  try {
    body = (await req.json()) as ManyChatRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const subscriberId = String(body.subscriber_id ?? '').trim();
  if (!subscriberId) {
    return Response.json({ error: 'subscriber_id required' }, { status: 400 });
  }

  // Anything that still looks like a ManyChat token is not real input. Trusting
  // these is what let the bot answer people with nonsense and mute itself.
  const message = realValue(body.message) ?? '';
  const igUsername = realValue((body.ig_username ?? '').replace(/^@/, ''));
  const firstName = realValue(body.first_name);
  const keyword = realValue(body.keyword);

  try {
    const reply = await handle({ subscriberId, message, igUsername, firstName, keyword, body });
    return Response.json(reply);
  } catch (err) {
    // A thrown error must never leave someone staring at an unanswered DM, and it
    // must never silently swallow a lead. Hand the thread to Ali instead.
    console.error('[manychat/reply] failed:', err);
    try {
      await pause(subscriberId);
      await pushAdmin(
        'Instagram',
        `Bot errored on @${igUsername ?? subscriberId}. Thread handed over, reply in ManyChat.`,
      );
    } catch (inner) {
      console.error('[manychat/reply] escalation also failed:', inner);
    }
    return Response.json(block([DEFAULTS.holding], [{ action: 'add_tag', tag_name: HUMAN_TAG }]));
  }
}

async function handle(input: {
  subscriberId: string;
  message: string;
  igUsername: string | null;
  firstName: string | null;
  keyword: string | null;
  body: ManyChatRequest;
}): Promise<ManyChatResponse> {
  const { subscriberId, message, igUsername, firstName, keyword, body } = input;

  const contact = await loadOrCreateContact(subscriberId, igUsername, firstName, keyword);
  if (message) await log(subscriberId, 'user', message, null, keyword);

  const { data: settings } = await supabaseAdmin
    .from('ig_settings')
    .select('bot_enabled, test_mode, test_usernames, opener_copy, apply_copy, not_a_fit_copy, holding_copy')
    .eq('id', 1)
    .maybeSingle();

  // Every outgoing line comes from here, so Ali can rewrite any of them in /admin
  // and see it on the next message. A blank field falls back to the default rather
  // than sending an empty DM.
  const copy: Copy = {
    opener: settings?.opener_copy?.trim() || DEFAULTS.opener,
    apply: settings?.apply_copy?.trim() || DEFAULTS.apply,
    notAFit: settings?.not_a_fit_copy?.trim() || DEFAULTS.notAFit,
    holding: settings?.holding_copy?.trim() || DEFAULTS.holding,
  };

  const who = contact.ig_username ?? igUsername ?? subscriberId;

  // Off means off. This used to send the holding line, so switching the bot off
  // still DM'd everyone who commented — the opposite of what a kill switch is for.
  if (settings?.bot_enabled === false) return silent();

  // Ali is handling this thread himself. Saying anything here talks over him.
  if (contact.bot_paused) return silent();

  // Test mode: only the handles on the list get replies, everyone else gets
  // silence. Lets the whole flow be exercised against our own accounts without
  // a single real follower seeing it.
  if (settings?.test_mode !== false && !isAllowedInTest(settings?.test_usernames, igUsername ?? contact.ig_username)) {
    if (contact.stage === 'new') {
      await update(subscriberId, { stage: 'organic' });
      await pushAdmin('Instagram (test mode)', `@${who} messaged but test mode is on, so nothing was sent.`);
    }
    return silent();
  }

  // Existing clients and people who already applied must never be sold to. There
  // is no Instagram handle on the users table, so application_forms is the bridge:
  // it carries both the handle and the email the portal knows them by.
  const known = await identifyKnownPerson(igUsername ?? contact.ig_username);
  if (known) {
    if (contact.stage !== known) {
      await update(subscriberId, { stage: known });
      await pushAdmin(
        known === 'client' ? 'Client on Instagram' : 'Applicant on Instagram',
        `@${who} messaged. Bot stayed quiet.`,
      );
    }
    await pause(subscriberId);
    return silent([{ action: 'add_tag', tag_name: HUMAN_TAG }]);
  }

  // No message worth acting on: an image, a reaction, or a ManyChat field that
  // never resolved. Silence beats guessing, and it must not mute the thread.
  if (!message && contact.stage !== 'new' && contact.stage !== 'organic') {
    return silent();
  }

  // Someone who just messaged the account out of the blue. ManyChat sends a
  // keyword only from the comment automation, so no keyword on a stranger's first
  // message means they never answered a call to action: it's a friend, a fan, or
  // anyone else. Say nothing at all and let Ali see it. Opening with "what
  // symptoms are you dealing with" to someone who said "yo bro" is worse than
  // being slow to reply.
  if (!keyword && (contact.stage === 'new' || contact.stage === 'organic')) {
    if (contact.stage === 'new') {
      await update(subscriberId, { stage: 'organic' });
      await pushAdmin('Instagram DM', `@${who}: "${message.slice(0, 140) || '(no text)'}"`);
    }
    return silent();
  }

  // Fall back to the keyword they first arrived on: a later DM in the same thread
  // may not carry one, and the campaign decides how this conversation behaves.
  const campaign = await loadCampaign(keyword ?? contact.keyword);
  const resourceUrl = campaign?.resource_url ?? body.resource_url?.trim() ?? null;

  // First touch: they commented a keyword and this is the DM that follows. Someone
  // who DM'd first and only later commented arrives here too, hence 'organic'.
  //
  // Two shapes of campaign. With a link, the post promised a resource, so the DM
  // hands it over and asks for an email. Without one, the keyword just opens a
  // conversation: send the opener and nothing else, because asking for an email
  // straight after "tell me what's going on" reads like a form, not a person.
  if (contact.stage === 'new' || contact.stage === 'organic') {
    await update(subscriberId, { stage: 'link_sent', keyword: keyword ?? contact.keyword });
    const stageAction: ManyChatAction[] = [
      { action: 'set_field_value', field_name: 'thp_stage', value: 'link_sent' },
    ];

    // No campaign row for this keyword. Ali adds CTA words in ManyChat whenever he
    // posts, so a missing row has to still open the conversation properly instead
    // of dead-ending someone who did exactly what the post asked.
    const opener = campaign?.dm_copy?.trim() || copy.opener;

    if (!resourceUrl) return respond(contact, [stripLinkToken(opener)], stageAction);
    return respond(contact, [withLink(opener, resourceUrl), STATIC.emailAsk], stageAction);
  }

  // Already been through the funnel and has now commented on another post. They
  // are asking for whatever that post promised, not restarting a conversation.
  // Hand over the link if there is one, otherwise say nothing: the old behaviour
  // sent "give me a bit" and muted a returning lead for good.
  if (keyword && contact.stage !== 'link_sent') {
    if (resourceUrl) return respond(contact, [resourceUrl], [], 'repeat_comment');
    await pushAdmin('Instagram', `@${who} commented ${keyword} again. Already at "${contact.stage}", nothing sent.`);
    return silent();
  }

  // Their answer to the opener. Not everyone who replies is a prospect: someone
  // saying "no symptoms, I just like your content" must not be pitched, or the
  // whole account reads as a funnel. Classify first, then pick a fixed line.
  if (contact.stage === 'link_sent' && !resourceUrl && message) {
    const handle = contact.ig_username ?? contact.subscriber_id;
    const src = contact.keyword ?? keyword ?? 'a post';

    if (contact.turns_today >= MAX_AI_TURNS_PER_DAY) {
      // Quiet for the rest of the day rather than muted for good: the counter
      // resets tomorrow, so a talkative real lead is not punished like a troll.
      await pushAdmin('Instagram', `@${who} hit the daily reply cap. Quiet until tomorrow.`);
      return silent([{ action: 'add_tag', tag_name: HUMAN_TAG }]);
    }
    await update(subscriberId, { turns_today: contact.turns_today + 1, turns_date: today() });

    const openerIntent = await classifyOpenerReply(message);

    if (openerIntent === 'symptoms' || openerIntent === 'optimizing') {
      await update(subscriberId, { stage: 'lead' });
      await pushAdmin(
        'Instagram lead',
        `@${handle} replied to ${src}: "${message.slice(0, 140)}". Sent them the application.`,
      );
      return respond(contact, [withLink(copy.apply, `${appUrl()}/apply`)], [
        { action: 'set_field_value', field_name: 'thp_stage', value: 'lead' },
      ], openerIntent);
    }

    if (openerIntent === 'not_a_fit') {
      // Thank them, point at YouTube, and stop. The yt-nudge tag is what ManyChat
      // hangs its delayed follow-up off, since this endpoint can only ever reply
      // to an incoming message and never start a conversation of its own.
      await update(subscriberId, { stage: 'closed' });
      return respond(contact, [copy.notAFit], [
        { action: 'add_tag', tag_name: YT_TAG },
        { action: 'set_field_value', field_name: 'thp_stage', value: 'closed' },
      ], 'not_a_fit');
    }

    // A question deserves an acknowledgement. Anything the model could not place
    // gets silence, because a wrong guess is worse than a slow human reply.
    if (openerIntent === 'question') {
      return escalate(contact, copy, `asked a question: "${message.slice(0, 120)}"`, true);
    }
    return escalate(contact, copy, 'replied with something off script');
  }

  // Cheap path first: if there's an email in the text, no model call is needed.
  let email = extractEmail(message);
  let intent: Intent = email ? 'giving_email' : 'other';

  if (!email && message) {
    if (contact.turns_today >= MAX_AI_TURNS_PER_DAY) {
      return escalate(contact, copy, 'hit the daily reply cap');
    }
    const classified = await classify(message);
    intent = classified.intent;
    email = classified.email;
    await update(subscriberId, {
      turns_today: contact.turns_today + 1,
      turns_date: today(),
    });
  }

  if (email) return capture(contact, email, copy, keyword);

  if (intent === 'wants_link') {
    const campaignForResend = campaign ?? (await loadCampaign(contact.keyword));
    const url = campaignForResend?.resource_url ?? resourceUrl;
    if (url) return respond(contact, [url, STATIC.emailAsk], [], 'wants_link');
    return escalate(contact, copy, 'asked for the link again but none is configured');
  }

  if (intent === 'not_interested') {
    await update(contact.subscriber_id, { stage: 'closed' });
    return silent([{ action: 'set_field_value', field_name: 'thp_stage', value: 'closed' }]);
  }

  // 'question' and 'other' both mean a human should read this.
  if (intent === 'question') return escalate(contact, copy, 'asked a question', true);
  return escalate(contact, copy, 'sent something off script');
}

/* ---------- branches ---------- */

/** An email arrived. Record the lead, tell Ali, point them at /apply. */
async function capture(contact: Contact, email: string, copy: Copy, keyword: string | null): Promise<ManyChatResponse> {
  const applyUrl = `${appUrl()}/apply`;
  const handle = contact.ig_username ?? contact.subscriber_id;

  await update(contact.subscriber_id, { email, stage: 'lead' });

  // Existing portal client — they don't belong in the lead funnel.
  const { data: client } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (client) {
    await update(contact.subscriber_id, { stage: 'client' });
    await notifyAdmin(email, 'new_message', `Existing client @${handle} messaged on Instagram.`);
    await pause(contact.subscriber_id);
    return respond(contact, [STATIC.client(`${appUrl()}/dashboard`)], [
      { action: 'add_tag', tag_name: HUMAN_TAG },
    ], 'giving_email');
  }

  const { data: existingApplication } = await supabaseAdmin
    .from('application_forms')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (existingApplication) {
    await update(contact.subscriber_id, { stage: 'applied' });
    return respond(contact, [STATIC.alreadyApplied(applyUrl)], [
      { action: 'set_field_value', field_name: 'thp_stage', value: 'applied' },
    ], 'giving_email');
  }

  // application_forms is written in full by /apply. A partial row from Instagram
  // is a lead, not an application, so a failure here (missing column, constraint)
  // must not lose the lead: the email is already on ig_contacts and Ali still gets
  // the push either way.
  const { error } = await supabaseAdmin.from('application_forms').insert({
    email,
    full_name: contact.first_name ?? null,
    instagram: contact.ig_username ?? null,
    how_found_us: 'instagram',
  });
  if (error) console.error('[manychat/reply] application_forms insert failed:', error);

  // Not notifyAdmin: an Instagram lead has no users row, and alarms.user_email is
  // a foreign key onto it. The lead's record is the ig_contacts row and the
  // application_forms row above.
  await pushAdmin(
    'Instagram lead',
    `@${handle} (${email})${keyword ? ` from keyword ${keyword}` : ''}.`,
  );

  return respond(contact, [withLink(copy.apply, applyUrl)], [
    { action: 'set_field_value', field_name: 'thp_stage', value: 'lead' },
    { action: 'set_field_value', field_name: 'thp_email', value: email },
  ], 'giving_email');
}

/**
 * Hand the thread to Ali and stop replying to it.
 *
 * `speak` is off by default on purpose. This used to answer every unclassifiable
 * message with "give me a bit and I'll get back to you here", which meant an
 * empty message, a photo, a stray retry or an API blip all produced a confusing
 * DM to somebody who had done nothing. Only a real question from an engaged lead
 * earns an acknowledgement; everything else is Ali's to answer, quietly.
 */
async function escalate(contact: Contact, copy: Copy, why: string, speak = false): Promise<ManyChatResponse> {
  const handle = contact.ig_username ?? contact.subscriber_id;
  await pause(contact.subscriber_id);
  await pushAdmin('Instagram', `@${handle} ${why}. Bot paused, reply in ManyChat.`);

  if (!speak) return silent([{ action: 'add_tag', tag_name: HUMAN_TAG }]);

  // The holding line goes out below, so start its 24h window here. Otherwise the
  // very next message gets told the same thing a second time.
  await update(contact.subscriber_id, { holding_sent_at: new Date().toISOString() });
  return respond(contact, [copy.holding], [{ action: 'add_tag', tag_name: HUMAN_TAG }], 'escalated');
}

/** The holding line, but only once a day per contact. */
async function holdingOnce(contact: Contact, copy: Copy): Promise<ManyChatResponse> {
  const last = contact.holding_sent_at ? Date.parse(contact.holding_sent_at) : 0;
  if (Date.now() - last < 24 * 60 * 60 * 1000) return silent();

  await update(contact.subscriber_id, { holding_sent_at: new Date().toISOString() });
  return respond(contact, [copy.holding]);
}

/* ---------- Claude: classification only ---------- */

/**
 * Read the answer to "what's going on with you" and decide which fixed line to
 * send. This is the one judgement call in the whole flow, so it is the one place
 * a model is used, and it still writes nothing: it picks a branch.
 *
 * Anything it cannot place goes to Ali. Getting this wrong in the pitching
 * direction is far more costly than getting it wrong in the handover direction.
 */
async function classifyOpenerReply(message: string): Promise<OpenerIntent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 'other';

  try {
    const response = await new Anthropic({ apiKey }).messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      system:
        'A men\'s hormone coach asked someone on Instagram: "tell me what symptoms you have, or are you just trying to optimize your testosterone?". ' +
        'Classify their reply. You never write replies and you never answer the message.\n' +
        'symptoms: describes any problem, complaint or symptom (tired, brain fog, low libido, weight, mood, sleep, bloodwork).\n' +
        'optimizing: no real complaint, but wants to improve, optimize or get better numbers.\n' +
        'not_a_fit: says they have no symptoms and are not looking for help, or is just complimenting the content, or is only here as a fan.\n' +
        'question: asks anything back, about price, the programme, the coach, or how it works.\n' +
        'other: anything you are unsure about, including one word replies with no meaning.\n' +
        'If the reply mixes a complaint with a question, prefer question so a human handles it.',
      tools: [{
        name: 'classify',
        description: 'Record which kind of reply this is.',
        input_schema: {
          type: 'object',
          properties: {
            intent: {
              type: 'string',
              enum: ['symptoms', 'optimizing', 'not_a_fit', 'question', 'other'],
            },
          },
          required: ['intent'],
        },
      }],
      tool_choice: { type: 'tool', name: 'classify' },
      messages: [{ role: 'user', content: message.slice(0, 1000) }],
    });

    const tool = response.content.find(c => c.type === 'tool_use');
    if (!tool || tool.type !== 'tool_use') return 'other';

    const out = (tool.input as { intent?: string }).intent;
    const valid: OpenerIntent[] = ['symptoms', 'optimizing', 'not_a_fit', 'question', 'other'];
    return valid.includes(out as OpenerIntent) ? (out as OpenerIntent) : 'other';
  } catch (err) {
    // A model outage must not turn into a mistimed sales pitch.
    console.error('[manychat/reply] opener classification failed:', err);
    return 'other';
  }
}

async function classify(message: string): Promise<{ intent: Intent; email: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // No key configured is not a reason to guess. Send it to a human.
  if (!apiKey) return { intent: 'other', email: null };

  try {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system:
      'You classify a single Instagram DM sent to a fitness coaching business. ' +
      'You never write replies and you never answer the message. Classify only.\n' +
      'giving_email: contains an email address, or is clearly trying to give one.\n' +
      'wants_link: asking for the link/resource again, or saying it did not arrive.\n' +
      'question: asking anything about the coaching, price, programme, health or the coach.\n' +
      'not_interested: declining, unsubscribing, or telling us to stop.\n' +
      'other: anything else, including greetings and things you are unsure about.',
    tools: [
      {
        name: 'classify',
        description: 'Record the classification of the message.',
        input_schema: {
          type: 'object',
          properties: {
            intent: {
              type: 'string',
              enum: ['giving_email', 'wants_link', 'question', 'not_interested', 'other'],
            },
            email: {
              type: 'string',
              description: 'The email address if one is present, otherwise an empty string.',
            },
          },
          required: ['intent', 'email'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'classify' },
    messages: [{ role: 'user', content: message.slice(0, 1000) }],
  });

  const tool = response.content.find(c => c.type === 'tool_use');
  if (!tool || tool.type !== 'tool_use') return { intent: 'other', email: null };

  const out = tool.input as { intent?: string; email?: string | null };
  const intents: Intent[] = ['giving_email', 'wants_link', 'question', 'not_interested', 'other'];
  const intent = intents.includes(out.intent as Intent) ? (out.intent as Intent) : 'other';

  // Trust the regex over the model for the actual address.
  return { intent, email: out.email ? extractEmail(out.email) : null };
  } catch (err) {
    // An Anthropic outage used to throw all the way out and permanently pause
    // the contact. Fall back to "a human should look at this" instead.
    console.error('[manychat/reply] classification failed:', err);
    return { intent: 'other', email: null };
  }
}

/* ---------- storage ---------- */

async function loadOrCreateContact(
  subscriberId: string,
  igUsername: string | null,
  firstName: string | null,
  keyword: string | null,
): Promise<Contact> {
  const { data: existing } = await supabaseAdmin
    .from('ig_contacts')
    .select('*')
    .eq('subscriber_id', subscriberId)
    .maybeSingle();

  if (existing) {
    const contact = existing as Contact;
    // Roll the per-day counter over when the date changes.
    if (contact.turns_date !== today()) {
      await update(subscriberId, { turns_today: 0, turns_date: today() });
      contact.turns_today = 0;
      contact.turns_date = today();
    }
    // ManyChat can start knowing only a subscriber id and fill in the rest later.
    const patch: Record<string, unknown> = {};
    if (igUsername && !contact.ig_username) patch.ig_username = igUsername;
    if (firstName && !contact.first_name) patch.first_name = firstName;
    if (Object.keys(patch).length > 0) {
      await update(subscriberId, patch);
      Object.assign(contact, patch);
    }
    return contact;
  }

  const row = {
    subscriber_id: subscriberId,
    ig_username: igUsername,
    first_name: firstName,
    email: null,
    keyword,
    stage: 'new',
    bot_paused: false,
    turns_today: 0,
    turns_date: today(),
    holding_sent_at: null,
  };
  const { error } = await supabaseAdmin.from('ig_contacts').insert(row);
  if (error) {
    // Two DMs landing at once both miss the select and both insert. Whoever
    // loses re-reads the winner's row rather than failing the request.
    const { data: raced } = await supabaseAdmin
      .from('ig_contacts')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();
    if (raced) return raced as Contact;
    throw error;
  }
  return row as Contact;
}

/**
 * Is this Instagram handle already a client, or someone who has applied?
 *
 * The users table has no Instagram column, so application_forms is the bridge:
 * it stores the handle alongside the email the portal knows them by. Without
 * this, a paying client who commented a keyword was asked about his symptoms and
 * then sold the programme he was already paying for.
 */
async function identifyKnownPerson(handle: string | null): Promise<'client' | 'applied' | null> {
  const h = handle?.replace(/^@/, '').trim();
  if (!h) return null;

  // limit(1) rather than maybeSingle(): the same handle legitimately appears more
  // than once (a client who applied twice), and maybeSingle turns that into an
  // error, which would silently switch this protection off for exactly the people
  // it exists to protect.
  // Handles are stored inconsistently: /apply and onboarding both accept a leading
  // @, so the same person can be "@name" or "name". Match either, or a client gets
  // pitched because of a stray character.
  const safe = h.replace(/[^A-Za-z0-9._]/g, '');
  if (!safe) return null;

  // A client is a client whether they gave the handle on their application or
  // typed it into their intake. Checking only the application form recognised
  // 2 of 43 accounts, so both sources matter.
  const { data: clientsByIntake } = await supabaseAdmin
    .from('users')
    .select('email')
    .or(`diagnostic_data->>instagramHandle.ilike.${safe},diagnostic_data->>instagramHandle.ilike.@${safe}`)
    .limit(1);

  if (clientsByIntake && clientsByIntake.length > 0) return 'client';

  const { data: applications } = await supabaseAdmin
    .from('application_forms')
    .select('email')
    .or(`instagram.ilike.${safe},instagram.ilike.@${safe}`)
    .limit(5);

  const emails = (applications ?? []).map(a => a.email).filter(Boolean) as string[];
  if (emails.length === 0) return null;

  const { data: clients } = await supabaseAdmin
    .from('users')
    .select('email')
    .in('email', emails.map(e => e.toLowerCase()))
    .limit(1);

  return clients && clients.length > 0 ? 'client' : 'applied';
}

async function loadCampaign(keyword: string | null): Promise<Campaign | null> {
  if (!keyword) return null;
  const { data } = await supabaseAdmin
    .from('ig_campaigns')
    .select('keyword, resource_url, dm_copy, active')
    .ilike('keyword', escapeLike(keyword))
    .eq('active', true)
    .maybeSingle();
  return (data as Campaign) ?? null;
}

async function update(subscriberId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin
    .from('ig_contacts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('subscriber_id', subscriberId);
  if (error) console.error('[manychat/reply] contact update failed:', error);
}

async function pause(subscriberId: string): Promise<void> {
  await update(subscriberId, { bot_paused: true });
}

async function log(
  subscriberId: string,
  role: 'user' | 'bot',
  content: string,
  intent: string | null,
  keyword: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('ig_conversations')
    .insert({ subscriber_id: subscriberId, role, content, intent, keyword });
  if (error) console.error('[manychat/reply] transcript insert failed:', error);
}

/** Send messages and record them in the transcript in one step. */
async function respond(
  contact: Contact,
  texts: string[],
  actions: ManyChatAction[] = [],
  intent: string | null = null,
): Promise<ManyChatResponse> {
  for (const text of texts) {
    await log(contact.subscriber_id, 'bot', text, intent, contact.keyword);
  }
  return block(texts, actions);
}
