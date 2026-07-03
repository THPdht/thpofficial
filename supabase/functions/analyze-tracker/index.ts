/**
 * analyze-tracker — Supabase Edge Function
 *
 * Called after a client submits their daily v2 tracker.
 * Reads the last 5 trackers + the client's published diagnosis (baseline),
 * sends to Claude, stores punchy talking points + flags in tracker_analysis.
 *
 * Invoke: supabase.functions.invoke('analyze-tracker', { body: { userEmail, date } })
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

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
    const { userEmail, date } = await req.json();
    if (!userEmail || !date) {
      return new Response(JSON.stringify({ error: "Missing userEmail or date" }), { status: 400 });
    }

    // Fetch last 5 trackers (most recent first)
    const { data: trackers } = await supabase
      .from("daily_trackers")
      .select("*")
      .eq("user_email", userEmail)
      .order("date", { ascending: false })
      .limit(5);

    if (!trackers || trackers.length === 0) {
      return new Response(JSON.stringify({ error: "No trackers found" }), { status: 404 });
    }

    // Fetch published diagnosis (source of truth / baseline)
    const { data: diagnosis } = await supabase
      .from("diagnostics")
      .select("content, title")
      .eq("user_email", userEmail)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch previous analysis for pattern context
    const { data: prevAnalysis } = await supabase
      .from("tracker_analysis")
      .select("date, talking_points, flags")
      .eq("user_email", userEmail)
      .order("date", { ascending: false })
      .limit(4);

    const trackerText = trackers
      .map((t, i) => {
        const sections = [t.circadian, t.training, t.nutrition, t.vitals, t.psychological, t.business]
          .filter(Boolean)
          .map((s) => JSON.stringify(s))
          .join("\n");
        return `--- Tracker ${i === 0 ? "(TODAY)" : `(${t.date})`} ---\n${sections}`;
      })
      .join("\n\n");

    const diagnosisText = diagnosis
      ? `CLIENT BASELINE DIAGNOSIS:\nTitle: ${diagnosis.title}\n${JSON.stringify(diagnosis.content)}`
      : "No diagnosis on file.";

    const prevFlagsText =
      prevAnalysis && prevAnalysis.length > 0
        ? `PREVIOUS FLAGS (for pattern detection):\n${prevAnalysis
            .map((a) => `${a.date}: ${(a.flags || []).join(", ")}`)
            .join("\n")}`
        : "";

    const prompt = `You are reading a client's daily hormone/lifestyle tracker on behalf of their coach.

${diagnosisText}

${prevFlagsText}

${trackerText}

Your job: give the coach exactly what he needs to know in 10 seconds before talking to this client.

Output as JSON with two arrays:
- "talking_points": 3-5 bullets, short and punchy (max 12 words each). What's worth mentioning today — wins, drops, patterns.
- "flags": 1-3 bullets for things that need follow-up — broken promises, declining trends, missing data, inconsistencies vs baseline. If nothing flagged, return empty array.

No fluff. No filler. No summaries. Just signal.
JSON only, no markdown.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    let parsed: { talking_points?: string[]; flags?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { talking_points: ["Analysis unavailable"], flags: [] };
    }

    // Upsert into tracker_analysis
    await supabase.from("tracker_analysis").upsert({
      user_email: userEmail,
      date,
      talking_points: parsed.talking_points ?? [],
      flags: parsed.flags ?? [],
      generated_at: new Date().toISOString(),
    }, { onConflict: "user_email,date" });

    return new Response(JSON.stringify({ success: true, talking_points: parsed.talking_points, flags: parsed.flags }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("[analyze-tracker]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
