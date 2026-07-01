import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');
  const token = searchParams.get('token');

  if (sessionId) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return Response.json({ valid: false });
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey, { apiVersion: '2026-06-24.dahlia' as const });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return Response.json({
        valid: session.payment_status === 'paid',
        email: session.customer_email ?? undefined,
      });
    } catch {
      return Response.json({ valid: false });
    }
  }

  if (token) {
    const { data } = await supabaseAdmin
      .from('invites')
      .select('email, used, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (!data) return Response.json({ valid: false });
    if (data.used) return Response.json({ valid: false });
    if (new Date(data.expires_at) < new Date()) return Response.json({ valid: false });
    return Response.json({ valid: true, email: data.email });
  }

  return Response.json({ valid: false });
}
