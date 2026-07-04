/**
 * Stripe webhook — auto-creates/updates portal accounts on payment.
 *
 * Setup (one-time):
 *   Stripe Dashboard → Developers → Webhooks → Add endpoint
 *   URL: https://thpofficial.com/api/webhooks/stripe
 *   Events to listen for: checkout.session.completed
 *   Copy signing secret → set STRIPE_WEBHOOK_SECRET in Vercel env vars
 */

import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return new Response('Stripe not configured', { status: 500 });

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-06-24.dahlia' as const });
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      // No secret yet — accept raw (set STRIPE_WEBHOOK_SECRET in Vercel to enforce)
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error('[webhooks/stripe] Signature error:', err);
    return new Response('Webhook signature invalid', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') return new Response('OK', { status: 200 });

    const email = (session.customer_details?.email ?? session.customer_email ?? '').toLowerCase().trim();
    if (!email) return new Response('OK', { status: 200 });

    const name = session.customer_details?.name ?? email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const metadata = session.metadata ?? {};
    const paymentType = metadata.payment_type; // 'deposit' | 'balance' | undefined
    const amountPaid = (session.amount_total ?? 0) / 100; // Stripe amounts are in pence/cents

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('email, status, diagnostic_data')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      // Client already exists — ensure they're at least pending and tagged as 1:1
      const diag = existing.diagnostic_data || {};
      const updates: Record<string, unknown> = {
        diagnostic_data: { ...diag, clientType: diag.clientType ?? '1on1', source: diag.source ?? 'stripe' },
      };
      if (existing.status === 'new') updates.status = 'pending';

      // Payment type tracking
      if (paymentType === 'deposit') {
        const totalOwed = metadata.total_owed ? parseFloat(metadata.total_owed) : null;
        updates.deposit_paid = amountPaid;
        if (totalOwed !== null) updates.total_owed = totalOwed;
      } else if (paymentType === 'balance') {
        const { data: u } = await supabaseAdmin.from('users').select('total_owed').eq('email', email).maybeSingle();
        updates.deposit_paid = u?.total_owed ?? amountPaid;
      } else if (paymentType === 'monthly') {
        updates.last_monthly_paid = new Date().toISOString().split('T')[0];
        updates.last_monthly_amount = amountPaid;
        if (metadata.agreed_monthly) updates.agreed_monthly = parseFloat(metadata.agreed_monthly);
      }

      await supabaseAdmin.from('users').update(updates).eq('email', email);
      console.log(`[webhooks/stripe] Updated existing client ${email} (payment_type=${paymentType ?? 'none'})`);
    } else {
      // Brand new client — create their account
      const insertData: Record<string, unknown> = {
        email,
        name,
        password: Math.random().toString(36).slice(2, 12),
        status: 'pending',
        streak: 0,
        longest_streak: 0,
        joined_at: new Date().toISOString().split('T')[0],
        diagnostic_data: { clientType: '1on1', source: 'stripe' },
      };
      if (paymentType === 'deposit') {
        insertData.deposit_paid = amountPaid;
        if (metadata.total_owed) insertData.total_owed = parseFloat(metadata.total_owed);
      }
      await supabaseAdmin.from('users').insert(insertData);
      console.log(`[webhooks/stripe] Created new client ${email}`);
    }

    // --- Referral auto-marking ---
    // If this email was referred by someone, mark the referral as paid
    const { data: referral } = await supabaseAdmin
      .from('referrals')
      .select('id, referrer_email')
      .eq('referred_email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (referral) {
      await supabaseAdmin
        .from('referrals')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', referral.id);

      // Count how many paying referrals this referrer now has
      const { count } = await supabaseAdmin
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_email', referral.referrer_email)
        .eq('status', 'paid');

      const { data: referrer } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('email', referral.referrer_email)
        .maybeSingle();

      const referrerName = referrer?.name ?? referral.referrer_email;

      if (count === 3) {
        // Check no open alarm of this type already
        const { data: existingAlarm } = await supabaseAdmin
          .from('alarms')
          .select('id')
          .eq('user_email', referral.referrer_email)
          .eq('type', 'referral_milestone')
          .is('dismissed_at', null)
          .limit(1);

        if (!existingAlarm?.length) {
          await supabaseAdmin.from('alarms').insert({
            user_email: referral.referrer_email,
            type: 'referral_milestone',
            message: `${referrerName} has earned a free month — 3 paying referrals`,
            created_at: new Date().toISOString(),
          });
        }
      }

      console.log(`[webhooks/stripe] Referral marked paid for ${email} (referrer: ${referral.referrer_email}, total paid: ${count})`);
    }
  }

  return new Response('OK', { status: 200 });
}
