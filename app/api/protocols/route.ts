import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const all = searchParams.get('all') === '1'; // admin mode — returns drafts too

  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  let query = supabaseAdmin
    .from('protocols')
    .select('*')
    .eq('user_email', email)
    .order('stage', { ascending: true });

  if (!all) {
    query = query.eq('status', 'sent');
  }

  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ protocols: data ?? [] });
}
