/**
 * Someone who already finished the funnel wrote back.
 *
 * Setup (one-time):
 *   ManyChat → THP-Qualify-Full-Step → Condition #2, the "If not" path
 *   Condition: has tag `qualify-done`
 *   POST https://thpofficial.com/api/manychat/followup
 *   Header: x-manychat-secret: <MANYCHAT_WEBHOOK_SECRET>
 *   Body:   subscriber_id, ig_username, message
 *   No response mapping. Nothing is sent to the person.
 *
 * The funnel ends by removing both tags, so a later DM fails the tag gate and
 * flow 2 exits silently. That silence is the rule working — the bot must never
 * answer a question in Ali's voice, and a wrong answer to "how much is it"
 * costs more than a slow one. What was missing is that nobody was told, so a
 * qualified lead replying "I don't want Telegram" went unanswered by anyone.
 *
 * This endpoint is that missing half: it writes the line down and pushes Ali.
 * It sends no message, changes no tag, and makes no decision — deliberately the
 * dullest route in the codebase, because the interesting version of it would be
 * a bot talking to leads again.
 *
 * Always answers 200. ManyChat surfaces a non-200 as a broken step, and a
 * notification we failed to deliver must not also look like a flow error.
 */

import { realValue, secretMatches } from '@/lib/manychat';
import { pushAdmin } from '@/lib/notifyAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/** A DM is short. Past this it is noise, and the push would be unreadable anyway. */
const MAX_MESSAGE = 600;

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get('x-manychat-secret'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await handle(req);
  } catch (err) {
    console.error('[manychat/followup] unhandled:', err);
    return Response.json({ ok: false });
  }
}

async function handle(req: Request): Promise<Response> {
  const fields = await readBody(req);

  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const v = fields[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number') return String(v);
    }
    return null;
  };

  const subscriberId = pick('subscriber_id', 'id', 'key', 'user_ns');
  const igUsername = realValue((pick('ig_username', 'username', 'user_name') ?? '').replace(/^@+/, ''));
  const message = realValue(pick('message', 'last_input_text', 'text'))?.slice(0, MAX_MESSAGE) ?? null;

  const who = igUsername ? `@${igUsername}` : 'Someone';

  console.log(`[manychat/followup] ${who} :: ${JSON.stringify(message ?? '')}`);

  // The record comes first. If the push fails Ali can still find them in the
  // panel; if the row fails there is nothing to find them by later.
  try {
    const { error } = await supabaseAdmin.from('ig_followups').insert({
      subscriber_id: subscriberId,
      ig_username: igUsername,
      message,
    });
    if (error) console.error('[manychat/followup] insert failed:', error.message, error.code ?? '');
  } catch (err) {
    console.error('[manychat/followup] insert threw:', err);
  }

  // Awaited, not fired and forgotten: the function can be frozen as soon as it
  // responds, which would drop the notification some of the time.
  await pushAdmin(
    'Instagram lead wrote back',
    message ? `${who}: “${message.slice(0, 120)}”` : `${who} sent something — open the DM`,
  );

  return Response.json({ ok: true });
}

/**
 * Accept JSON or form encoding, the same as the qualifier.
 *
 * An External Request rebuilt without its Content-Type header sends form data,
 * and that once looked exactly like an empty body — which cost us a real lead.
 * Reading both shapes is cheaper than diagnosing that twice.
 */
async function readBody(req: Request): Promise<Record<string, unknown>> {
  let raw = '';
  try {
    raw = (await req.text()).trim();
  } catch {
    return {};
  }
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    // Not JSON. Try form encoding.
  }

  try {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of new URLSearchParams(raw)) fields[k] = v;
    return fields;
  } catch {
    return {};
  }
}
