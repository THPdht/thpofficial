import { supabaseAdmin } from '@/lib/supabaseAdmin';

function authCheck(req: Request): boolean {
  const pw = req.headers.get('x-admin-password');
  return pw === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/diagnostics?email= — fetch all diagnostics for a user (including unpublished)
export async function GET(req: Request) {
  if (!authCheck(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  if (!email) return Response.json({ error: 'Missing email.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('diagnostics')
    .select('*')
    .eq('user_email', email.toLowerCase().trim())
    .order('stage', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ diagnostics: data ?? [] });
}

// PATCH /api/admin/diagnostics — publish a diagnosis
// Body: { diagId: string }
export async function PATCH(req: Request) {
  if (!authCheck(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { diagId } = await req.json();
  if (!diagId) return Response.json({ error: 'Missing diagId.' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('diagnostics')
    .update({ published: true })
    .eq('id', diagId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
