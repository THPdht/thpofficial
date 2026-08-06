/**
 * Is this person describing a problem, or just saying hello?
 *
 * Setup (one-time):
 *   ManyChat → THP-Qualify-Full-Step → Actions #1 → External Request
 *   POST https://thpofficial.com/api/manychat/classify
 *   Header: x-manychat-secret: <MANYCHAT_WEBHOOK_SECRET>
 *   Body:   reply, subscriber_id, ig_username
 *   Response mapping: $.classification → thp_classification
 *
 * This replaces AI Step 1, which failed twice in one day and in two different
 * ways. First it waited for a reply that the trigger had already consumed, so
 * it parked forever. Then, once it stopped waiting, it wrote its answer to the
 * field and still never handed control to the next node — a ManyChat AI Step
 * runs until it judges its own goal met, and "classify this, say nothing" gives
 * it nothing to finish. It also called "no appetite, never hungry, low energy"
 * a FAN. An External Request has none of that: it answers, the flow continues.
 *
 * ENGAGED is the safe default. A fan who reaches Ali costs him one glance; a
 * lead misread as a fan is told "appreciate you supporting boss" and is gone.
 * That exact message went to a real person with three stated symptoms.
 */

import Anthropic from '@anthropic-ai/sdk';
import { realValue, secretMatches } from '@/lib/manychat';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/** A DM sentence is short. Anything longer is noise or an attack. */
const MAX_INPUT = 600;

/** A slow answer is a stalled conversation, so treat it as a failed one. */
const LLM_TIMEOUT_MS = 12_000;

type Classification = 'ENGAGED' | 'FAN';

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get('x-manychat-secret'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Nothing may throw out of here. An error page would leave the ManyChat
  // condition reading a blank field, and blank does not contain ENGAGED, so a
  // crash would silently route every lead to the fan branch.
  try {
    return await handle(req);
  } catch (err) {
    console.error('[manychat/classify] unhandled:', err);
    return Response.json({ classification: 'ENGAGED' satisfies Classification });
  }
}

async function handle(req: Request): Promise<Response> {
  const { fields, rawBody } = await readBody(req);

  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const v = fields[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number') return String(v);
    }
    return null;
  };

  const text = realValue(pick('reply', 'thp_reply', 'last_input_text', 'message', 'text'));
  const subscriberId = pick('subscriber_id', 'id', 'key', 'user_ns');
  const igUsername = realValue((pick('ig_username', 'username', 'user_name') ?? '').replace(/^@+/, ''));

  if (!text) {
    const seen = rawBody.trim() ? `body: ${rawBody.trim().slice(0, 200)}` : 'no body at all';
    return await answer('ENGAGED', `empty input · ${seen}`, null, subscriberId, igUsername);
  }

  const input = text.slice(0, MAX_INPUT);
  const verdict = await read(input);

  if (!verdict) {
    return await answer('ENGAGED', 'classifier unavailable', input, subscriberId, igUsername);
  }

  return await answer(verdict.classification, verdict.reason, input, subscriberId, igUsername);
}

/* ---------- Claude ---------- */

/**
 * Decide whether the reply describes anything wrong, or anything wanted.
 *
 * The bar is deliberately low. People open with pleasantries before getting to
 * the point — "thanks for replying man, anyway I've had zero energy for months"
 * is a lead, and the greeting at the front is not evidence of anything. Only a
 * message with no complaint and no goal anywhere in it is a fan.
 */
async function read(message: string): Promise<{ classification: Classification; reason: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[manychat/classify] ANTHROPIC_API_KEY is not set');
    return null;
  }

  try {
    const response = await new Anthropic({ apiKey }).messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system:
          'A men\'s hormone coach asked someone on Instagram: "tell me exactly what symptoms you are dealing with, ' +
          'and if there are no symptoms, what are you trying to achieve with testosterone optimization?". ' +
          'Decide whether their reply describes a problem or a goal.\n\n' +
          'ENGAGED — the reply mentions ANY of: a symptom or complaint (low energy, poor sleep, no appetite, ' +
          'low libido, weight gain, brain fog, mood, stress, aches), something feeling off or wrong, a health or ' +
          'body goal (build muscle, lose fat, optimise testosterone, feel better, perform better), or a question ' +
          'about the coaching.\n' +
          'FAN — the reply contains none of the above: pure greeting, praise, thanks, emoji, or small talk.\n\n' +
          'People greet before they get to the point. "Thanks for replying, anyway I have no energy" is ENGAGED — ' +
          'judge the whole message, never just how it opens. When the reply is ambiguous or you are unsure, ' +
          'answer ENGAGED: a fan reaching the coach costs one glance, a real lead dismissed as a fan is lost.',
        tools: [{
          name: 'record',
          description: 'Record the classification of the reply.',
          input_schema: {
            type: 'object',
            properties: {
              classification: {
                type: 'string',
                enum: ['ENGAGED', 'FAN'],
                description: 'ENGAGED if any symptom, complaint, goal or question is present. Otherwise FAN.',
              },
              reason: {
                type: 'string',
                description:
                  'Six words or fewer naming what decided it — the symptom or goal you found, or ' +
                  '"greeting only" when there was none.',
              },
            },
            required: ['classification', 'reason'],
          },
        }],
        tool_choice: { type: 'tool', name: 'record' },
        messages: [{ role: 'user', content: message }],
      },
      { signal: AbortSignal.timeout(LLM_TIMEOUT_MS) },
    );

    const tool = response.content.find(c => c.type === 'tool_use');
    if (!tool || tool.type !== 'tool_use') return null;

    const out = tool.input as { classification?: unknown; reason?: unknown };
    const classification: Classification = out.classification === 'FAN' ? 'FAN' : 'ENGAGED';
    const reason = typeof out.reason === 'string' && out.reason.trim()
      ? out.reason.trim().slice(0, 80)
      : 'no reason given';

    return { classification, reason };
  } catch (err) {
    // An outage must not dismiss a real lead as a fan.
    console.error('[manychat/classify] failed:', err);
    return null;
  }
}

/* ---------- respond + log ---------- */

async function answer(
  classification: Classification,
  reason: string,
  rawText: string | null,
  subscriberId: string | null,
  igUsername: string | null,
): Promise<Response> {
  console.log(
    `[manychat/classify] @${igUsername ?? '?'} → ${classification} (${reason}) :: ${JSON.stringify(rawText ?? '')}`,
  );

  // A logging failure can never change the answer.
  try {
    const { error } = await supabaseAdmin.from('ig_classifications').insert({
      subscriber_id: subscriberId,
      ig_username: igUsername,
      raw_text: rawText,
      classification,
      reason,
    });
    if (error) console.error('[manychat/classify] log insert failed:', error.message, error.code ?? '');
  } catch (err) {
    console.error('[manychat/classify] log insert threw:', err);
  }

  return Response.json({ classification });
}

/** Accept JSON or form encoding — see the qualifier for why both. */
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
    // Not JSON. Try form encoding.
  }

  try {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of new URLSearchParams(trimmed)) fields[k] = v;
    if (Object.keys(fields).length > 0) return { fields, rawBody };
  } catch {
    // Neither shape.
  }

  return { fields: {}, rawBody };
}
