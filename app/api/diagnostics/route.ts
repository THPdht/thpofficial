import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('diagnostics')
    .select('id, stage, published, created_at')
    .eq('user_email', email)
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ diagnostics: data ?? [] });
}
