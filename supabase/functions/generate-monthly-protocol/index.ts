/**
 * generate-monthly-protocol — Supabase Edge Function
 *
 * Runs on the 1st of every month (Supabase cron: "0 6 1 * *").
 * For each active 1-on-1 client: reads last 30 trackers + analysis + diagnosis baseline,
 * generates a protocol draft, inserts it as status='pending_review'.
 * Also creates an alarm for THP.
 *
 * Can also be triggered manually: POST with { userEmail } to run for one client.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

async function generateForClient(email: string, name: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const monthLabel = monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // Get trackers from last 30 days
  const { data: trackers } = await supabase
    .from("daily_trackers")
    .select("*")
    .eq("user_email", email)
    .gte("date", monthStart.toISOString().split("T")[0])
    .lte("date", monthEnd.toISOString().split("T")[0])
    .order("date", { ascending: true });

  const trackerCount = trackers?.length ?? 0;

  // Get tracker analysis for the period
  const { data: analyses } = await supabase
    .from("tracker_analysis")
    .select("date, talking_points, flags")
    .eq("user_email", email)
    .gte("date", monthStart.toISOString().split("T")[0])
    .lte("date", monthEnd.toISOString().split("T")[0])
    .order("date", { ascending: true });

  // Get diagnosis baseline
  const { data: diagnosis } = await supabase
    .from("diagnostics")
    .select("content, title")
    .eq("user_email", email)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get previous protocols for context
  const { data: prevProtocols } = await supabase
    .from("protocols")
    .select("title, content, month_start")
    .eq("user_email", email)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(2);

  // Compliance message
  let complianceNote = "";
  if (trackerCount < 20) {
    complianceNote = `\n\nIMPORTANT: This client only filled ${trackerCount} trackers this month. Address their consistency directly in the protocol — not harshly, but directly. Consistent daily data is the foundation of meaningful protocol adjustments.`;
  } else if (trackerCount >= 20 && trackerCount < 30) {
    complianceNote = `\n\nNote: Client filled ${trackerCount}/30 trackers this month. Good consistency — acknowledge it briefly.`;
  } else {
    complianceNote = `\n\nNote: Client filled all 30 trackers this month. That's exceptional — acknowledge it.`;
  }

  const trackerSummary = trackers
    ? trackers.map((t) =>
        `${t.date}: ${[t.circadian, t.training, t.nutrition, t.vitals, t.psychological, t.business]
          .filter(Boolean)
          .map((s) => JSON.stringify(s))
          .join(" | ")}`
      ).join("\n")
    : "No tracker data.";

  const analysisSummary = analyses
    ? analyses.map((a) => `${a.date} — Points: ${(a.talking_points || []).join("; ")} | Flags: ${(a.flags || []).join("; ")}`).join("\n")
    : "No analysis data.";

  const prevProtoText = prevProtocols?.length
    ? prevProtocols.map((p) => `Protocol (${p.month_start}): ${p.title}`).join("\n")
    : "No previous protocols.";

  const prompt = `You are generating a monthly coaching protocol for ${name}.

CLIENT BASELINE DIAGNOSIS (source of truth — never contradict this):
${diagnosis ? `${diagnosis.title}\n${JSON.stringify(diagnosis.content)}` : "No diagnosis on file."}

PREVIOUS PROTOCOLS:
${prevProtoText}

30-DAY TRACKER DATA (${monthLabel}):
${trackerSummary}

COACHING NOTES & FLAGS FROM THE MONTH:
${analysisSummary}
${complianceNote}

Write a focused monthly protocol for ${name} for the coming month. Structure:

1. WHERE YOU ARE (3-4 sentences — honest assessment based on the data this month, grounded in the diagnosis baseline)
2. THE FOCUS THIS MONTH (one clear theme — what we're solving or building)
3. YOUR PROTOCOL (daily non-negotiables — specific, actionable, no fluff. 5-8 items max)
4. THE MINDSET WORK (2-3 psychological directives tied to what you saw in the tracker)
5. WHAT TO WATCH (2-3 metrics or behaviours THP will be tracking this month)

Tone: direct, confident, personal. This is THP's voice talking to the client — not generic coaching copy.
No markdown headers with ##. Use the numbered labels above.
Do not mention AI, data, or trackers explicitly to the client.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";
  const title = `${monthLabel} Protocol — ${name}`;

  // Insert protocol as pending_review
  const { data: inserted, error } = await supabase.from("protocols").insert({
    user_email: email,
    stage: 1,
    title,
    content: { text: content },
    status: "pending_review",
    month_start: monthStart.toISOString().split("T")[0],
    tracker_count: trackerCount,
    created_at: new Date().toISOString(),
  }).select("id").single();

  if (error) throw error;

  // Create alarm for THP
  await supabase.from("alarms").insert({
    user_email: email,
    type: "protocol_pending",
    message: `Protocol ready for review — ${name} (${trackerCount}/30 trackers this month)`,
    created_at: new Date().toISOString(),
  });

  return { protocolId: inserted?.id, trackerCount, title };
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
    let targetEmail: string | null = null;

    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      targetEmail = body.userEmail ?? null;
    }

    const results: unknown[] = [];
    const errors: unknown[] = [];

    if (targetEmail) {
      // Single client mode
      const { data: user } = await supabase
        .from("users")
        .select("email, name, diagnostic_data")
        .eq("email", targetEmail)
        .maybeSingle();

      if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

      const result = await generateForClient(user.email, user.name);
      results.push(result);
    } else {
      // Cron mode — all active 1-on-1 clients
      const { data: clients } = await supabase
        .from("users")
        .select("email, name, diagnostic_data")
        .eq("status", "active");

      const oneOnOne = (clients ?? []).filter(
        (c) => c.diagnostic_data?.clientType !== "skool"
      );

      for (const client of oneOnOne) {
        try {
          const result = await generateForClient(client.email, client.name);
          results.push({ email: client.email, ...result });
        } catch (err) {
          errors.push({ email: client.email, error: String(err) });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results, errors }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("[generate-monthly-protocol]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
