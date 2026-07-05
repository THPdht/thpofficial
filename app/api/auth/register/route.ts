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

  const referral_code = Math.random().toString(36).slice(2, 8).toUpperCase();

  const { error } = await supabaseAdmin.from('users').insert({
    name: name.trim(),
    email: norm,
    password,
    status: 'new',
    streak: 0,
    longest_streak: 0,
    joined_at: new Date().toISOString().split('T')[0],
    referral_code,
  });

  if (error) {
    console.error('[register] Supabase insert error:', error);
    return Response.json({ error: 'Could not create account. Please try again.' }, { status: 500 });
  }

  return Response.json({ success: true });
}
