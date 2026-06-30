import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email ?? session.customer_email;
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : undefined;
    const refCode = session.metadata?.ref ?? (session.client_reference_id ?? undefined);

    if (email) {
      const norm = email.toLowerCase().trim();

      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('email, diagnostic_data')
        .eq('email', norm)
        .maybeSingle();

      if (existing) {
        const diag = existing.diagnostic_data || {};
        await supabaseAdmin.from('users').update({
          diagnostic_data: { ...diag, stripeCustomerId },
        }).eq('email', norm);
      } else {
        await supabaseAdmin.from('users').insert({
          name: session.customer_details?.name ?? norm,
          email: norm,
          password: '',
          status: 'new',
          streak: 0,
          longest_streak: 0,
          joined_at: new Date().toISOString().split('T')[0],
          diagnostic_data: { stripeCustomerId },
        });
      }

      if (refCode) {
        await supabaseAdmin.from('referrals').insert({
          code: refCode,
          referred_email: norm,
        });
      }
    }
  }

  return Response.json({ received: true });
}
