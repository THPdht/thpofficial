import { timingSafeEqual } from 'crypto';

/**
 * ManyChat dynamic block responses.
 *
 * ManyChat calls our endpoint from an "External Request" step and sends whatever
 * we return straight to the user on Instagram. The shape below is ManyChat's
 * documented v2 response format — anything else renders as an error in the DM.
 *
 * Limits ManyChat enforces: 10 messages, 5 actions, 11 quick replies.
 *
 * Note on links: URL buttons are deliberately not used. Meta's Instagram DM API
 * is far more restrictive about attachments than Messenger, and a rejected button
 * fails the whole send. Bare URLs in the message text render as tappable links on
 * Instagram and always go through.
 */

export type ManyChatAction =
  | { action: 'add_tag'; tag_name: string }
  | { action: 'remove_tag'; tag_name: string }
  | { action: 'set_field_value'; field_name: string; value: string };

export interface ManyChatResponse {
  version: 'v2';
  content: {
    messages: { type: 'text'; text: string }[];
    actions?: ManyChatAction[];
  };
  /**
   * Every message as one string, so a plain External Request step can map a
   * single field instead of walking content.messages[n].text. Ignored by a real
   * Dynamic Block, which reads `content` above. Both wirings work off one response.
   */
  reply: string;
}

/** The fields the ManyChat External Request step is configured to send us. */
export interface ManyChatRequest {
  subscriber_id?: string | number;
  ig_username?: string;
  first_name?: string;
  message?: string;
  /** Set per post on the comment trigger. Never hardcoded here. */
  keyword?: string;
  /** Optional per-trigger override when a campaign row doesn't exist yet. */
  resource_url?: string;
}

export function block(texts: string[], actions: ManyChatAction[] = []): ManyChatResponse {
  const messages = texts
    .filter(t => t.trim().length > 0)
    .slice(0, 10)
    .map(text => ({ type: 'text' as const, text }));

  return {
    version: 'v2',
    content: actions.length > 0
      ? { messages, actions: actions.slice(0, 5) }
      : { messages },
    reply: messages.map(m => m.text).join('\n\n'),
  };
}

/**
 * Say nothing at all. Used when the bot is paused for a contact — Ali is
 * handling that thread himself and a bot message on top would talk over him.
 */
export function silent(actions: ManyChatAction[] = []): ManyChatResponse {
  return block([], actions);
}

/**
 * Constant-time comparison of the shared secret.
 *
 * timingSafeEqual throws when the buffers differ in length, which would itself
 * leak the secret's length, so length is checked first and always returns false.
 */
export function secretMatches(provided: string | null): boolean {
  const expected = process.env.MANYCHAT_WEBHOOK_SECRET;
  // Fail closed. An unset secret must never mean "let everyone in" — this
  // endpoint writes lead data and triggers pushes to Ali's phone.
  if (!expected || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * ManyChat sends the raw `{{field}}` token when a body field was typed as text
 * rather than inserted, or when Instagram has no value for it. Every one of our
 * real leads arrived this way and the bot cheerfully fed "{{last_input_text}}"
 * to an AI classifier. Treat any such value as missing input.
 */
export function realValue(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s || s.includes('{{') || s.includes('}}')) return null;
  return s;
}

/** Escape LIKE wildcards so a keyword can only ever match its own campaign row. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, c => `\\${c}`);
}

/** First email address in a free-text message, lowercased, or null. */
export function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase().trim() : null;
}
