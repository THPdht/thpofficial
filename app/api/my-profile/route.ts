/**
 * The small set of details a client may change about themselves.
 *
 * Right now that is their Instagram handle. It matters because the Instagram bot
 * decides whether someone commenting a keyword is a stranger or an existing
 * client, and without a handle on file a paying client gets sold the coaching
 * they already pay for. Collecting it from the client is far more reliable than
 * asking THP to chase 40 people for it.
 */

import { requireSelfOrAdmin } from '@/lib/apiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 });

  const email = String(body.email ?? '').toLowerCase().trim();
  if (!email) return Response.json({ error: 'email required' }, { status: 400 });

  // Only the signed-in client themselves, or admin. Without this any caller who
  // knows an email address could rewrite that client's record.
  const denied = await requireSelfOrAdmin(req, email);
  if (denied) return denied;

  if (!('instagramHandle' in body)) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 });
  }

  // Stored without the @ and lowercased so the bot's lookup matches whatever the
  // client typed. Instagram handles allow letters, numbers, dots and underscores.
  const handle = String(body.instagramHandle ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._]/g, '')
    .toLowerCase()
    .slice(0, 30);

  const { data, error: fetchErr } = await supabaseAdmin
    .from('users')
    .select('diagnostic_data')
    .eq('email', email)
    .maybeSingle();

  if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });
  if (!data) return Response.json({ error: 'No such account' }, { status: 404 });

  // Merge, never replace. diagnostic_data holds the client's entire 40-field
  // intake, and a whole-object write here would wipe all of it to save one line.
  const diag = (data.diagnostic_data as Record<string, unknown>) ?? {};
  const merged = { ...diag, instagramHandle: handle || undefined };

  const { error } = await supabaseAdmin
    .from('users')
    .update({ diagnostic_data: merged })
    .eq('email', email);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, instagramHandle: handle });
}
