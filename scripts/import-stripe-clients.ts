/**
 * One-time migration: import all active Stripe subscribers as THP clients.
 * Run: npx tsx scripts/import-stripe-clients.ts
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STRIPE_LIVE_KEY = process.env.STRIPE_SECRET_KEY!;

const stripe = new Stripe(STRIPE_LIVE_KEY, { apiVersion: "2026-06-24.dahlia" });

const DEFAULT_PASSWORD = "THP2025!";

// Delete all rows using a column that definitely has values
async function wipeByEmail(table: string) {
  const { error } = await supabase.from(table).delete().neq("user_email", "");
  if (error) console.warn(`  ⚠ ${table}: ${error.message}`);
  else console.log(`  ✅ ${table} cleared`);
}

async function main() {
  console.log("🔑 Connecting to Stripe live...");

  // ── 1. Fetch all active subscriptions ────────────────────────────────────
  const allSubs: Stripe.Subscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const page = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.customer", "data.items.data.price"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    allSubs.push(...page.data);
    hasMore = page.has_more;
    if (page.data.length > 0) startingAfter = page.data[page.data.length - 1].id;
  }

  console.log(`📦 Found ${allSubs.length} active subscriptions`);

  // ── 2. Build deduped client map ───────────────────────────────────────────
  type ClientRecord = {
    email: string;
    name: string;
    productId: string;
    monthlyRate: number;
    currency: string;
    stripeCustomerId: string;
  };

  const byEmail = new Map<string, ClientRecord>();
  const productIds = new Set<string>();

  for (const sub of allSubs) {
    const customer = sub.customer as Stripe.Customer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!customer || (customer as any).deleted) continue;
    const email = (customer.email ?? "").toLowerCase().trim();
    if (!email) continue;

    const item = sub.items.data[0];
    const price = item?.price as Stripe.Price | undefined;
    const amountCents = price?.unit_amount ?? 0;
    const monthlyRate = Math.round(amountCents / 100);
    const currency = (price?.currency ?? "usd").toUpperCase();
    const productId = typeof price?.product === "string" ? price.product : "";
    if (productId) productIds.add(productId);

    const existing = byEmail.get(email);
    if (!existing || monthlyRate > existing.monthlyRate) {
      byEmail.set(email, {
        email, name: customer.name ?? "Unknown",
        productId, monthlyRate, currency,
        stripeCustomerId: customer.id,
      });
    }
  }

  // ── 3. Fetch product names ────────────────────────────────────────────────
  const productNameMap = new Map<string, string>();
  for (const pid of productIds) {
    try {
      const prod = await stripe.products.retrieve(pid);
      productNameMap.set(pid, prod.name);
    } catch {
      productNameMap.set(pid, "THP COACHING");
    }
  }

  const clients = Array.from(byEmail.values()).map(c => ({
    ...c,
    productName: productNameMap.get(c.productId) ?? "THP COACHING",
  }));

  console.log(`👥 ${clients.length} unique clients\n`);
  console.log("Email".padEnd(44) + "Name".padEnd(30) + "Product".padEnd(32) + "Rate");
  console.log("─".repeat(118));
  for (const c of clients) {
    const rate = c.monthlyRate > 0 ? `${c.currency} ${c.monthlyRate}/mo` : "no price";
    console.log(c.email.padEnd(44) + c.name.substring(0, 28).padEnd(30) + c.productName.substring(0, 30).padEnd(32) + rate);
  }
  console.log("");

  // ── 4. Clear dependent tables first (FK order) ───────────────────────────
  console.log("🗑  Clearing existing data...");
  // Tables that reference users(email) via user_email column
  await wipeByEmail("daily_trackers");
  await wipeByEmail("protocols");
  await wipeByEmail("diagnostics");
  await wipeByEmail("blood_work");
  await wipeByEmail("referrals");
  await wipeByEmail("push_subscriptions");
  await wipeByEmail("messages");

  // Now delete users (email is the PK)
  const { error: delErr } = await supabase.from("users").delete().neq("email", "");
  if (delErr) {
    console.error("❌ Users delete failed:", delErr.message);
    console.log("Switching to upsert mode...");
  } else {
    console.log("  ✅ users cleared\n");
  }

  // ── 5. Insert or upsert clients ───────────────────────────────────────────
  console.log("📥 Inserting clients...");
  let ok = 0;
  let fail = 0;

  for (const c of clients) {
    const row = {
      name: c.name,
      email: c.email,
      password: DEFAULT_PASSWORD,
      status: "active",
      streak: 0,
      longest_streak: 0,
      joined_at: new Date().toISOString(),
      diagnostic_data: {
        accountStatus: "active",
        clientType: "1on1",
        stripeCustomerId: c.stripeCustomerId,
        monthlyRate: c.monthlyRate > 0 ? c.monthlyRate : null,
        productName: c.productName,
        protocolStatus: "building",
        payments: [],
      },
    };

    // Use upsert so it works even if user already exists
    const { error } = await supabase.from("users").upsert(row, { onConflict: "email" });

    if (error) {
      console.error(`  ❌ ${c.email} — ${error.message}`);
      fail++;
    } else {
      const rate = c.monthlyRate > 0 ? ` — $${c.monthlyRate}/mo` : "";
      console.log(`  ✅ ${c.name} <${c.email}>${rate}`);
      ok++;
    }
  }

  console.log(`\n✅ Done: ${ok} inserted/updated, ${fail} failed`);
  console.log(`🔑 Default password for all clients: ${DEFAULT_PASSWORD}`);
  console.log(`\nNote: One client (saputelligiorgio@gmail.com) has name "undefined undefined" in Stripe.`);
  console.log(`Update their name manually in the admin CRM.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
