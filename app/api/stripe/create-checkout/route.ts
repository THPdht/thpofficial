/**
 * Create a Stripe Checkout session for a client.
 * Called from admin panel — THP types the agreed amount, gets a URL to send.
 *
 * Body: { email: string, adminPw: string, amount: number (USD, e.g. 2000) }
 *
 * On payment success, Stripe redirects to:
 *   /onboarding?session_id={CHECKOUT_SESSION_ID}
 */

import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    const { email, adminPw, amount } = await req.json();

    if (!adminPw || adminPw !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!email) return Response.json({ error: 'email required' }, { status: 400 });
    if (!amount || Number(amount) < 1) {
      return Response.json({ error: 'Invalid amount — must be at least $1' }, { status: 400 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return Response.json({ error: 'Stripe not configured' }, { status: 500 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thpofficial.com';
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-06-24.dahlia' as const });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(Number(amount) * 100),
          product_data: { name: 'THP 1:1 Coaching' },
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/`,
    });

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[stripe/create-checkout]', err);
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
