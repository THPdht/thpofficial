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

    // The 5 trackers up to and including `date` — not the 5 most recent overall.
    // Anchoring to `date` keeps a re-run or a backfill reading the same history
    // the client had on that day rather than today's.
    const { data: trackers } = await supabase
      .from("daily_trackers")
      .select("*")
      .eq("user_email", userEmail)
      .lte("date", date)
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

    // Previous analysis for pattern context — again, only what preceded `date`.
    const { data: prevAnalysis } = await supabase
      .from("tracker_analysis")
      .select("date, talking_points, flags")
      .eq("user_email", userEmail)
      .lt("date", date)
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

Your job: give the coach 3 structured speaking notes — concise, clinical, ready to use in a call.

No fluff. No filler. Speak as if briefing the coach 10 seconds before the call.`;

    // Forced tool use rather than "reply with JSON": the model fenced its JSON
    // in every single response, JSON.parse failed every time, and the old catch
    // wrote "Analysis unavailable" into every row since July. A tool call comes
    // back already parsed, so there is no text to parse and nothing to strip.
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      tools: [{
        name: "speaking_notes",
        description: "Return the coach's three speaking notes and any flags.",
        input_schema: {
          type: "object",
          properties: {
            section1: { type: "string", description: "3-4 sentences on TODAY's tracker — what's notable, wins, drops, specific readings worth mentioning." },
            section2: { type: "string", description: "3-4 sentences on PATTERNS across the last 5 trackers — trends, consistency, anything improving or declining." },
            section3: { type: "string", description: "3-4 sentences tying this back to the CLIENT'S DIAGNOSIS — how today fits their clinical picture, what's on track, what's drifting." },
            flags: {
              type: "array",
              items: { type: "string" },
              description: "1-3 SHORT bullets for urgent follow-ups (broken habits, declining trends, missing data). Empty array if nothing critical.",
            },
          },
          required: ["section1", "section2", "section3", "flags"],
        },
      }],
      tool_choice: { type: "tool", name: "speaking_notes" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse) {
      // Never write a placeholder over the row: a missing analysis is honest,
      // a fake one reads as a real note. Surface it instead.
      console.error("[analyze-tracker] no tool_use block", {
        userEmail, date, stopReason: response.stop_reason,
      });
      return new Response(
        JSON.stringify({ error: "Model did not return the speaking_notes tool call" }),
        { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    const parsed = toolUse.input as {
      section1?: string; section2?: string; section3?: string; flags?: string[];
    };

    // Store sections as talking_points array (3 items) — compatible with existing schema
    const talkingPoints = [parsed.section1 ?? "", parsed.section2 ?? "", parsed.section3 ?? ""];

    // Upsert into tracker_analysis
    await supabase.from("tracker_analysis").upsert({
      user_email: userEmail,
      date,
      talking_points: talkingPoints,
      flags: parsed.flags ?? [],
      generated_at: new Date().toISOString(),
    }, { onConflict: "user_email,date" });

    return new Response(JSON.stringify({ success: true, talking_points: talkingPoints, flags: parsed.flags }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("[analyze-tracker]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
