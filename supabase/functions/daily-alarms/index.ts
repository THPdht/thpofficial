/**
 * daily-alarms — Supabase Edge Function
 *
 * Runs at 8am UTC daily (Supabase cron: "0 8 * * *").
 * For each active 1-on-1 client, checks:
 *   1. Missed trackers — last 3 days, any gap → alarm
 *   2. Protocol unread — sent 48h+ ago, not opened → alarm
 *   3. Diagnosis unread — published but never viewed → alarm
 *   4. Low compliance — <15 trackers with <10 days left in month → alarm
 *
 * Never duplicates an undismissed alarm of the same type for the same user.
 *
 * Can also be triggered manually: POST (no body required).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function hasOpenAlarm(userEmail: string, type: string): Promise<boolean> {
  const { data } = await supabase
    .from("alarms")
    .select("id")
    .eq("user_email", userEmail)
    .eq("type", type)
    .is("dismissed_at", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function insertAlarm(userEmail: string, type: string, message: string) {
  const exists = await hasOpenAlarm(userEmail, type);
  if (!exists) {
    await supabase.from("alarms").insert({
      user_email: userEmail,
      type,
      message,
      created_at: new Date().toISOString(),
    });
  }
}

async function checkClient(email: string, name: string) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // --- 1. Missed trackers ---
  // Build last 3 calendar dates (excluding today)
  const last3: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    last3.push(d.toISOString().split("T")[0]);
  }

  const { data: recentTrackers } = await supabase
    .from("daily_trackers")
    .select("date")
    .eq("user_email", email)
    .in("date", last3);

  const filledDates = new Set((recentTrackers ?? []).map((t) => t.date));
  const missedDates = last3.filter((d) => !filledDates.has(d));

  if (missedDates.length >= 2) {
    const daysAgo = missedDates.length;
    await insertAlarm(
      email,
      "missed_trackers",
      `${name} hasn't filled a tracker in ${daysAgo} days`
    );
  }

  // --- 2. Protocol unread ---
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const { data: unreadProtocol } = await supabase
    .from("protocols")
    .select("id, sent_at")
    .eq("user_email", email)
    .eq("status", "sent")
    .lt("sent_at", cutoff48h)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (unreadProtocol) {
    // Check if user has opened their protocol since it was sent
    const { data: user } = await supabase
      .from("users")
      .select("last_protocol_opened")
      .eq("email", email)
      .maybeSingle();

    const lastOpened = user?.last_protocol_opened;
    const sentAt = unreadProtocol.sent_at;

    if (!lastOpened || lastOpened < sentAt) {
      await insertAlarm(
        email,
        "protocol_unread",
        `${name} hasn't opened their protocol (sent ${Math.floor((now.getTime() - new Date(sentAt).getTime()) / (3600 * 1000))}h ago)`
      );
    }
  }

  // --- 3. Diagnosis unread ---
  const { data: diagnosis } = await supabase
    .from("diagnostics")
    .select("published, created_at")
    .eq("user_email", email)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (diagnosis) {
    const { data: user } = await supabase
      .from("users")
      .select("last_diagnosis_viewed")
      .eq("email", email)
      .maybeSingle();

    if (!user?.last_diagnosis_viewed) {
      await insertAlarm(
        email,
        "diagnosis_unread",
        `${name} hasn't viewed their diagnosis`
      );
    }
  }

  // --- 4. Low compliance ---
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = daysInMonth - dayOfMonth;

  if (daysLeft < 10) {
    const { data: monthTrackers } = await supabase
      .from("daily_trackers")
      .select("id")
      .eq("user_email", email)
      .gte("date", monthStart.toISOString().split("T")[0])
      .lte("date", today);

    const count = monthTrackers?.length ?? 0;
    if (count < 15) {
      await insertAlarm(
        email,
        "low_compliance",
        `${name} on track for low compliance this month (${count}/${daysInMonth} trackers, ${daysLeft} days left)`
      );
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Fetch all active 1-on-1 clients
    const { data: clients, error } = await supabase
      .from("users")
      .select("email, name, diagnostic_data")
      .eq("status", "active");

    if (error) throw error;

    const oneOnOne = (clients ?? []).filter(
      (c) => c.diagnostic_data?.clientType !== "skool"
    );

    const results: unknown[] = [];
    const errors: unknown[] = [];

    for (const client of oneOnOne) {
      try {
        await checkClient(client.email, client.name);
        results.push({ email: client.email });
      } catch (err) {
        errors.push({ email: client.email, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: results.length, errors }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("[daily-alarms]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
