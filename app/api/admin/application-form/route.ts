import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pw = searchParams.get('pw');
  const email = searchParams.get('email');

  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!email) {
    return Response.json({ error: 'Missing email' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('application_forms')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data: data ?? null });
}
