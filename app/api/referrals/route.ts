import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/referrals?email=... — fetch referral list for a client
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('referrals')
    .select('id, referred_name, referred_email, status, submitted_at, paid_at')
    .eq('referrer_email', email)
    .order('submitted_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ referrals: data ?? [] });
}

// POST /api/referrals — submit a new referral
export async function POST(req: Request) {
  try {
    const { referrerEmail, referredName, referredEmail } = await req.json();
    if (!referrerEmail || !referredName || !referredEmail) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('referrals').insert({
      referrer_email: referrerEmail,
      referred_name: referredName,
      referred_email: referredEmail.toLowerCase().trim(),
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === '23505') {
        return Response.json({ error: 'You have already referred this person' }, { status: 409 });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[referrals]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
