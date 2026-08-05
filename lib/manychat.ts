import { timingSafeEqual } from 'crypto';

/**
 * What the site needs to talk to ManyChat — which is now very little.
 *
 * ManyChat owns the Instagram automation end to end: the trigger, every word
 * sent, the branching and the on/off switch. The site is called once per
 * conversation, at one fork, to answer a single question. See
 * app/api/manychat/qualify/route.ts.
 *
 * This file used to hold the response builders for a bot that wrote its own
 * messages — dynamic blocks, actions, tags, and a workaround for ManyChat not
 * clearing a mapped field when the value came back empty. That bot is gone and
 * so is all of it. Only the two guards the qualifier depends on remain.
 */

/**
 * Constant-time comparison of the shared secret.
 *
 * timingSafeEqual throws when the buffers differ in length, which would itself
 * leak the secret's length, so length is checked first and always returns false.
 */
export function secretMatches(provided: string | null): boolean {
  const expected = process.env.MANYCHAT_WEBHOOK_SECRET;
  // Fail closed. An unset secret must never mean "let everyone in".
  if (!expected || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * ManyChat sends the raw `{{field}}` token when a body field was typed as text
 * rather than inserted, or when it has no value to put there. Every one of our
 * early leads arrived that way and got fed to a classifier as if it were a
 * person talking. Treat any such value as missing input.
 */
export function realValue(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s || s.includes('{{') || s.includes('}}')) return null;
  return s;
}
