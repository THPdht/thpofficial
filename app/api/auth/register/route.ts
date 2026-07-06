import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  if (!name || !email || !password)
    return Response.json({ error: 'Missing required fields.' }, { status: 400 });

  const norm = email.toLowerCase().trim();

  // Check for existing account
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('email', norm)
    .maybeSingle();

  if (existing)
    return Response.json({ error: 'An account with this email already exists.' }, { status: 409 });

  const { error } = await supabaseAdmin.from('users').insert({
    name: name.trim(),
    email: norm,
    password,
    status: 'new',
    streak: 0,
    longest_streak: 0,
    joined_at: new Date().toISOString().split('T')[0],
  });

  if (error) {
    console.error('[register] Supabase insert error:', error);
    return Response.json({ error: 'Could not create account. Please try again.' }, { status: 500 });
  }

  // Insert new_application alarm for admin feed
  const { error: alarmErr } = await supabaseAdmin.from('alarms').insert({
    user_email: norm,
    type: 'new_application',
    message: `New application from ${name.trim()}`,
    created_at: new Date().toISOString(),
  });
  if (alarmErr) console.error('[register] alarm insert failed:', alarmErr);

  return Response.json({ success: true });
}
