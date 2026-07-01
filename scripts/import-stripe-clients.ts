/**
 * Import active Stripe customers into Supabase users table.
 *
 * Usage:
 *   STRIPE_KEY=sk_live_xxx npx tsx scripts/import-stripe-clients.ts
 *
 * Uses the LIVE Stripe key passed via env var (not the test key in .env.local).
 * Supabase connection uses SUPABASE_SERVICE_ROLE_KEY from .env.local.
 *
 * Safe to re-run — skips existing emails.
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const STRIPE_KEY = process.env.STRIPE_KEY ?? process.env.STRIPE_SECRET_KEY ?? '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!STRIPE_KEY) { console.error('❌  Set STRIPE_KEY env var (pass the live key)'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('❌  Missing Supabase env vars'); process.exit(1); }

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2026-06-24.dahlia' });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const isLive = STRIPE_KEY.startsWith('sk_live_');
console.log(`\n🔑  Stripe mode: ${isLive ? '✅  LIVE' : '⚠️   TEST (no real customers)'}`);
console.log(`📦  Supabase: ${SUPABASE_URL}\n`);

async function main() {
  // 1. Fetch all active subscriptions with expanded customer data
  const subscriptions: Stripe.Subscription[] = [];
  let cursor: string | undefined;
  do {
    const page = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.customer'],
      ...(cursor ? { starting_after: cursor } : {}),
    });
    subscriptions.push(...page.data);
    cursor = page.has_more ? page.data[page.data.length - 1].id : undefined;
  } while (cursor);

  console.log(`📋  Found ${subscriptions.length} active subscriptions in Stripe\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const sub of subscriptions) {
    const customer = sub.customer as Stripe.Customer;
    if (!customer || typeof customer === 'string' || customer.deleted) continue;

    const email = customer.email?.toLowerCase().trim();
    const name = customer.name?.trim() || customer.email?.split('@')[0] || 'Unknown';
    if (!email) { console.log(`⚠️   Skip — no email (${customer.id})`); continue; }

    // Check if already exists
    const { data: existing } = await supabase.from('users').select('email').eq('email', email).maybeSingle();
    if (existing) {
      // Update stripeCustomerId if missing
      await supabase.from('users')
        .update({ diagnostic_data: { stripeCustomerId: customer.id } })
        .eq('email', email)
        .is('diagnostic_data->stripeCustomerId', null);
      console.log(`⏭   SKIP  ${email} (already exists)`);
      skipped++;
      continue;
    }

    const joinedAt = new Date(customer.created * 1000).toISOString().split('T')[0];

    const { error } = await supabase.from('users').insert({
      name,
      email,
      password: '',
      status: 'active',
      streak: 0,
      longest_streak: 0,
      joined_at: joinedAt,
      diagnostic_data: { stripeCustomerId: customer.id },
    });

    if (error) {
      console.error(`❌  ERROR  ${email}: ${error.message}`);
      errors++;
    } else {
      console.log(`✅  ADDED  ${name} <${email}> (joined ${joinedAt})`);
      imported++;
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`✅  Imported : ${imported}`);
  console.log(`⏭   Skipped  : ${skipped}`);
  console.log(`❌  Errors   : ${errors}`);
  console.log(`─────────────────────────────\n`);
  console.log(`Next: generate invite links for imported clients from the admin panel.`);
}

main().catch(e => { console.error(e); process.exit(1); });
