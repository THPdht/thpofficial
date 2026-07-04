import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

  return Response.json({ success: true, user: data });
}
