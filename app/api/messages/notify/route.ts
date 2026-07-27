import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireSelfOrAdmin } from '@/lib/apiAuth';
import { notifyAdmin } from '@/lib/notifyAdmin';

/**
 * Tells THP a client just messaged him.
 *
 * Chat messages are inserted client-side through the anon key under RLS, so there
 * is no server hook to hang this off. The portal calls this after a successful
 * insert. It only ever raises an alarm — it cannot write the message itself, so a
 * forged call is noise at worst, and the caller still has to prove who they are.
 */
export async function POST(req: Request) {
  try {
    const { email, preview } = await req.json();
    if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

    const denied = await requireSelfOrAdmin(req, email);
    if (denied) return denied;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('nickname, name')
      .eq('email', email)
      .maybeSingle();
    const who = user?.nickname || user?.name || email;

    const snippet = typeof preview === 'string' && preview.trim()
      ? `: ${preview.trim().slice(0, 120)}`
      : '';

    await notifyAdmin(email, 'new_message', `${who} sent a message${snippet}`);

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[messages/notify]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
