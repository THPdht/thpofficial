import { supabaseAdmin, syncAuthPassword } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) return Response.json({ error: 'Missing credentials' }, { status: 400 });

  const norm = email.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', norm)
    .maybeSingle();

  if (error || !data) return Response.json({ error: 'No account found with this email.' }, { status: 401 });
  if (data.password !== password) return Response.json({ error: 'Incorrect password.' }, { status: 401 });

  // The table password is now confirmed correct, so it's safe to point Supabase Auth
  // at it. This heals accounts whose two passwords drifted apart before the invite
  // and change-password routes started syncing them — without it the client signs in
  // here, fails to get an Auth session, and hits the "access removed" screen.
  const { error: authError } = await syncAuthPassword(norm, password);
  if (authError) console.error('[auth/login] auth sync', authError);

  // Stamp the sign-in here rather than relying on /dashboard reporting it, so admin
  // can trust "never signed in" as the signal for who still needs an invite link.
  const now = new Date().toISOString();
  const { error: stampError } = await supabaseAdmin
    .from('users')
    .update({ last_login: now })
    .eq('email', norm);
  if (stampError) console.error('[auth/login] last_login', stampError);

  return Response.json({ success: true, user: { ...data, last_login: now } });
}
