import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('blood_work')
    .select('id, test_date, uploaded_at, markers, image_url')
    .eq('user_email', email)
    .order('uploaded_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ entries: data ?? [] });
}
