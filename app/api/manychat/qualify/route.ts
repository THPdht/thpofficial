/**
 * Instagram qualifier — the single question ManyChat asks this site.
 *
 * Setup (one-time):
 *   ManyChat → your flow → External Request
 *   POST https://thpofficial.com/api/manychat/qualify
 *   Header: x-manychat-secret: <MANYCHAT_WEBHOOK_SECRET>
 *   Body:   demographics, subscriber_id, ig_username
 *   Response mapping: $.status → thp_qualification
 *
 * ManyChat writes every word the person sees. It calls us once, at one fork:
 * qualified goes to Ali's Telegram for a call, not_qualified goes to the course.
 * So this endpoint answers one thing and does nothing else — no contact rows,
 * no stages, no pushes, no messages. It is deliberately not the bot in
 * ../reply/route.ts and shares none of its state.
 *
 * An outage, timeout, bad parse or empty body resolves to not_qualified — if we
 * never read the person we must not act on them. But a person we did read and
 * who simply left a question unanswered now qualifies: see decide(). The only
 * non-200 response is a 401.
 */

import Anthropic from '@anthropic-ai/sdk';
import { realValue, secretMatches } from '@/lib/manychat';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/** A DM sentence is short. Anything longer is noise or an attack. */
const MAX_INPUT = 600;

/** The model gets one shot, and a slow one is the same as a failed one. */
const LLM_TIMEOUT_MS = 12_000;

type Status = 'qualified' | 'not_qualified';

type WorkStatus = 'working' | 'student' | 'unemployed' | 'unknown';
type CountryTier = 'high_income' | 'other' | 'unknown';
type Marital = 'married' | 'single' | 'unknown';

interface Facts {
  age: string;
  work_status: WorkStatus;
  country: string;
  country_tier: CountryTier;
  marital: Marital;
}

const UNKNOWN: Facts = {
  age: 'unknown',
  work_status: 'unknown',
  country: 'unknown',
  country_tier: 'unknown',
  marital: 'unknown',
};

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get('x-manychat-secret'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // From here on nothing may throw out of the handler. An error page or an
  // empty body would leave the ManyChat condition reading a stale field, which
  // is exactly how a previous build re-sent a message it had never generated.
  try {
    return await handle(req);
  } catch (err) {
    console.error('[manychat/qualify] unhandled:', err);
    return Response.json({ status: 'not_qualified' satisfies Status });
  }
}

/**
 * Read the body whatever shape it turns up in.
 *
 * A rebuilt External Request block that lost its Content-Type header sends
 * form-encoded rather than JSON. req.json() throws on that, and the whole
 * request then looked identical to one carrying no body at all — a real lead
 * was routed to the course and the log could not tell us which had happened.
 * Returns the parsed fields plus the raw text, so a failure can name itself.
 */
async function readBody(req: Request): Promise<{ fields: Record<string, unknown>; rawBody: string }> {
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    return { fields: {}, rawBody: '' };
  }

  const trimmed = rawBody.trim();
  if (!trimmed) return { fields: {}, rawBody };

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return { fields: parsed as Record<string, unknown>, rawBody };
  } catch {
    // Not JSON. Fall through to form encoding.
  }

  try {
    const params = new URLSearchParams(trimmed);
    const fields: Record<string, unknown> = {};
    for (const [k, v] of params) fields[k] = v;
    if (Object.keys(fields).length > 0) return { fields, rawBody };
  } catch {
    // Not form-encoded either.
  }

  return { fields: {}, rawBody };
}

async function handle(req: Request): Promise<Response> {
  const { fields, rawBody } = await readBody(req);

  const raw = fields;
  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number') return String(v);
    }
    return null;
  };

  // realValue() rejects a raw {{token}}. ManyChat sends the literal token when
  // the field it points at is empty, and it is not a person talking.
  const text = realValue(pick('demographics', 'last_input_text', 'message', 'text'));
  const subscriberId = pick('subscriber_id', 'id', 'key', 'user_ns');
  const igUsername = realValue((pick('ig_username', 'username', 'user_name') ?? '').replace(/^@+/, ''));

  if (!text) {
    // Say what actually arrived. "empty input" alone could mean ManyChat sent
    // nothing, sent an unfilled {{token}}, or sent a body we could not read,
    // and those need three different fixes in three different places.
    const seen = rawBody.trim()
      ? `body: ${rawBody.trim().slice(0, 200)}`
      : 'no body at all';
    return await answer('not_qualified', `empty input · ${seen}`, UNKNOWN, null, subscriberId, igUsername);
  }

  const input = text.slice(0, MAX_INPUT);
  const facts = await extract(input);

  // An extraction failure is not a person who told us nothing — we simply did
  // not read them. Guessing either way is wrong, so it goes to the course.
  if (!facts) {
    return await answer('not_qualified', 'extraction unavailable', UNKNOWN, input, subscriberId, igUsername);
  }

  // The rule lives here, in code, and not in a prompt: the model reports what
  // the person said, this line decides what it means. Age and marital status
  // are recorded for review and deliberately do not affect the outcome.
  return await answer(decide(facts), reasonFor(facts), facts, input, subscriberId, igUsername);
}

/**
 * Reject only on what the person actually said.
 *
 * Asking "how old, working or student, married, where from" gets three of four
 * answers from most people, and requiring all of them sent a working 47-year-old
 * to the course because he never named his country. So silence is no longer a
 * rejection: only a stated student, or a stated country outside the paying
 * tiers, goes to YouTube. Everyone else reaches Ali, who is a human and can
 * disqualify in one glance — a wasted glance is cheaper than a lost customer.
 */
function decide(facts: Facts): Status {
  if (facts.work_status === 'student') return 'not_qualified';
  if (facts.country_tier === 'other') return 'not_qualified';
  return 'qualified';
}

/** One short, skimmable string explaining the decision in the log. */
function reasonFor(facts: Facts): string {
  if (facts.work_status === 'student') return 'work: student';
  if (facts.country_tier === 'other') return `country: ${facts.country} (other)`;
  const noted = [
    `work: ${facts.work_status}`,
    `country: ${facts.country}`,
  ].join(' · ');
  return `no stated disqualifier (${noted})`;
}

/* ---------- Claude: extraction only ---------- */

/**
 * Read the freeform answer to "how old are you, student or working, married or
 * not, and where you from?" and report the facts stated in it.
 *
 * The model is never asked whether someone qualifies. It only reports what was
 * said, and says unknown for anything it has to guess at — an invented country
 * would put a stranger in Ali's Telegram.
 *
 * Returns null if we could not read the reply at all. Since decide() now treats
 * an unknown fact as harmless, an outage that returned all-unknowns would send
 * every single person to Ali. Failure has to be distinguishable from silence.
 */
async function extract(message: string): Promise<Facts | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[manychat/qualify] ANTHROPIC_API_KEY is not set');
    return null;
  }

  try {
    const response = await new Anthropic({ apiKey }).messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system:
          'Someone on Instagram was asked: "how old are you, student or working, married or not, and where you from?". ' +
          'Report only the facts their reply actually states. You never write replies, you never answer the message, ' +
          'and you never decide whether they are a good customer.\n' +
          'Report "unknown" for anything not clearly stated. Never infer, never guess, never fill in a likely answer. ' +
          'A guess here has real consequences, an unknown does not.',
        tools: [{
          name: 'record',
          description: 'Record the facts stated in the reply.',
          input_schema: {
            type: 'object',
            properties: {
              age: {
                type: 'string',
                description: 'Their age as stated, or "unknown".',
              },
              work_status: {
                type: 'string',
                enum: ['working', 'student', 'unemployed', 'unknown'],
                description:
                  'working: employed, self-employed, runs a business, or names a job. ' +
                  'student: at school, university, or studying, even if they also work part time. ' +
                  'unemployed: not working, between jobs, or retired. ' +
                  'unknown: they did not say.',
              },
              country: {
                type: 'string',
                description:
                  'The country they are from or live in. If they name only a city, give the country that city is in. ' +
                  'Otherwise "unknown".',
              },
              country_tier: {
                type: 'string',
                enum: ['high_income', 'other', 'unknown'],
                description:
                  'high_income ONLY for: United States, Canada, United Kingdom, Ireland, Western Europe, ' +
                  'Scandinavia, Australia, New Zealand, and the Gulf states (UAE, Qatar, Saudi Arabia, Kuwait, ' +
                  'Bahrain, Oman). other: any country not on that list. unknown: no country stated, or you are ' +
                  'not certain which country they mean.',
              },
              marital: {
                type: 'string',
                enum: ['married', 'single', 'unknown'],
                description: 'married covers engaged. single covers divorced and dating. Otherwise unknown.',
              },
            },
            required: ['age', 'work_status', 'country', 'country_tier', 'marital'],
          },
        }],
        tool_choice: { type: 'tool', name: 'record' },
        messages: [{ role: 'user', content: message }],
      },
      { signal: AbortSignal.timeout(LLM_TIMEOUT_MS) },
    );

    const tool = response.content.find(c => c.type === 'tool_use');
    if (!tool || tool.type !== 'tool_use') return null;

    const out = tool.input as Partial<Record<keyof Facts, unknown>>;
    const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
      typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
    const str = (v: unknown): string =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : 'unknown';

    return {
      age: str(out.age),
      work_status: oneOf(out.work_status, ['working', 'student', 'unemployed', 'unknown'] as const, 'unknown'),
      country: str(out.country),
      country_tier: oneOf(out.country_tier, ['high_income', 'other', 'unknown'] as const, 'unknown'),
      marital: oneOf(out.marital, ['married', 'single', 'unknown'] as const, 'unknown'),
    };
  } catch (err) {
    // A model outage must never promote someone to a call.
    console.error('[manychat/qualify] extraction failed:', err);
    return null;
  }
}

/* ---------- respond + log ---------- */

/**
 * Log the decision, then answer.
 *
 * The response body is exactly { status } because the flow maps $.status into
 * thp_qualification. Nothing else belongs in it — in particular this must not
 * use block() from lib/manychat, which writes the thp_reply field the older
 * flow sends messages from.
 */
async function answer(
  status: Status,
  reason: string,
  facts: Facts,
  rawText: string | null,
  subscriberId: string | null,
  igUsername: string | null,
): Promise<Response> {
  console.log(
    `[manychat/qualify] @${igUsername ?? '?'} → ${status} (${reason}) :: ${JSON.stringify(rawText ?? '')}`,
  );

  // A logging failure can never change the answer. If the table is missing or
  // the insert fails, the person still gets routed correctly.
  try {
    const { error } = await supabaseAdmin.from('ig_qualifications').insert({
      subscriber_id: subscriberId,
      ig_username: igUsername,
      raw_text: rawText,
      age: facts.age,
      work_status: facts.work_status,
      country: facts.country,
      country_tier: facts.country_tier,
      marital: facts.marital,
      status,
      reason,
    });
    // Supabase errors stringify to {} in the log, so pull the message out.
    if (error) console.error('[manychat/qualify] log insert failed:', error.message, error.code ?? '');
  } catch (err) {
    console.error('[manychat/qualify] log insert threw:', err);
  }

  return Response.json({ status });
}
