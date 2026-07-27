import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin, requireSelfOrAdmin } from '@/lib/apiAuth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  const denied = await requireSelfOrAdmin(req, email);
  if (denied) return denied;

  let query = supabaseAdmin
    .from('diagnostics')
    .select('id, stage, published, created_at')
    .eq('user_email', email)
    .order('created_at', { ascending: false });

  // An unpublished diagnosis is THP's draft. Clients should not learn one exists.
  if (!isAdmin(req)) query = query.eq('published', true);

  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ diagnostics: data ?? [] });
}
