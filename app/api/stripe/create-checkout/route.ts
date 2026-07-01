/**
 * Create a Stripe Checkout session for a client.
 * Called from admin panel — returns a checkout URL THP can send to the client.
 *
 * Body: { email: string, adminPw: string, priceId?: string }
 *   priceId defaults to STRIPE_PRICE_ID env var.
 *
 * On payment success, Stripe redirects to:
 *   /onboarding?session_id={CHECKOUT_SESSION_ID}
 */

import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    const { email, adminPw, priceId } = await req.json();

    if (!adminPw || adminPw !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!email) return Response.json({ error: 'email required' }, { status: 400 });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return Response.json({ error: 'Stripe not configured' }, { status: 500 });

    const resolvedPriceId = priceId || process.env.STRIPE_PRICE_ID;
    if (!resolvedPriceId) {
      return Response.json({
        error: 'No Stripe price ID configured. Set STRIPE_PRICE_ID in environment variables or pass priceId in request.',
      }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thpofficial.com';

    const stripe = new Stripe(stripeKey, { apiVersion: '2026-06-24.dahlia' as const });
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${appUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/`,
    });

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[stripe/create-checkout]', err);
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
