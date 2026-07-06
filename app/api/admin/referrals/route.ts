import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pw = searchParams.get('pw');
  const email = searchParams.get('email');

  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('referrals')
    .select('id, referred_name, referred_email, status, submitted_at, paid_at')
    .eq('referrer_email', email.toLowerCase().trim())
    .order('submitted_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ referrals: data ?? [] });
}
