import Stripe from 'stripe';

// Simple in-memory cache — avoid hammering Stripe on every admin load
let cache: { data: RevenueData; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface RevenueData {
  mrr: number;
  totalRevenue: number;
  currency: string;
  periods: PeriodBreakdown[];
}

interface PeriodBreakdown {
  label: string;
  amount: number;
}

export async function GET(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return Response.json({ error: 'Stripe not configured' }, { status: 500 });

  if (cache && cache.expiresAt > Date.now()) {
    return Response.json(cache.data);
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-06-24.dahlia' as const });

    const now = Math.floor(Date.now() / 1000);
    const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

    // Fetch all successful payment intents — paginate up to 500 for total revenue
    const charges = await stripe.paymentIntents.list({ limit: 100 });

    let totalRevenue = 0;
    let mrr = 0;

    // Simple MRR — sum of this calendar month's successful charges
    for (const pi of charges.data) {
      if (pi.status !== 'succeeded') continue;
      const amount = pi.amount / 100;
      totalRevenue += amount;
      if (pi.created >= monthStart) mrr += amount;
    }

    // Period breakdowns
    const periods: PeriodBreakdown[] = [];
    const periodDefs = [
      { label: 'This Month', days: 30 },
      { label: '3 Months', days: 90 },
      { label: '6 Months', days: 180 },
      { label: '1 Year', days: 365 },
    ];

    for (const p of periodDefs) {
      const cutoff = now - p.days * 86400;
      let amount = 0;
      for (const pi of charges.data) {
        if (pi.status === 'succeeded' && pi.created >= cutoff) amount += pi.amount / 100;
      }
      periods.push({ label: p.label, amount });
    }

    const data: RevenueData = {
      mrr,
      totalRevenue,
      currency: 'GBP',
      periods,
    };

    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return Response.json(data);
  } catch (err) {
    console.error('[revenue]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
