import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

export async function POST(req: Request) {
  try {
    const { referralId, adminPw } = await req.json();
    if (adminPw !== ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!referralId) {
      return Response.json({ error: 'Missing referralId' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('referrals')
      .update({ status: 'paid' })
      .eq('id', referralId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[mark-referral-paid]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
