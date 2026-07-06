/**
 * analyze-blood-work — Supabase Edge Function
 *
 * Called after a client uploads a blood work image or PDF.
 * Downloads the file from Supabase Storage, sends to Claude vision,
 * extracts hormone/health markers as structured JSON, updates the blood_work row.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

const EXTRACT_PROMPT = `You are reading a blood test / lab results panel. Extract ALL health markers you can see.

Return ONLY a JSON object with this structure:
{
  "markers": {
    "marker_key": {
      "value": number_or_null,
      "unit": "string",
      "reference_range": "string or null",
      "flag": "high" | "low" | "normal" | null
    }
  },
  "test_date": "YYYY-MM-DD or null if not visible",
  "lab_name": "string or null",
  "notes": "anything unclear, unreadable, or that couldn't be extracted"
}

Use snake_case keys (e.g. total_t, free_t, shbg, estradiol, lh, fsh, cortisol, hematocrit, hemoglobin, rbc, psa, dhea_s, igf1, tsh, t3_free, t4_free, vitamin_d, ferritin, cholesterol, hdl, ldl, triglycerides, glucose, hba1c, creatinine, alt, ast).
For any additional markers not listed, include them with their actual name as key.
If a value is not present, omit it entirely.
JSON only, no markdown.`;

// Chunked base64 encoding to avoid call stack overflow on large files
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 4096;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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
    const { bloodWorkId, imageUrl, userEmail } = await req.json();
    if (!bloodWorkId || !imageUrl) {
      return new Response(JSON.stringify({ error: "Missing bloodWorkId or imageUrl" }), { status: 400 });
    }

    // Download file from Supabase Storage
    const fileResp = await fetch(imageUrl);
    if (!fileResp.ok) {
      console.error("[analyze-blood-work] failed to fetch file:", fileResp.status, imageUrl);
      return new Response(JSON.stringify({ error: "Failed to fetch uploaded file" }), { status: 400 });
    }
    const fileBuffer = await fileResp.arrayBuffer();
    const base64Data = arrayBufferToBase64(fileBuffer);
    const rawMimeType = fileResp.headers.get("content-type") ?? "image/jpeg";
    const isPdf = rawMimeType.includes("pdf");
    const imageMime = rawMimeType.split(";")[0] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    // PDFs use type:"document" + beta header; images use type:"image"
    type ContentBlock =
      | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
      | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
      | { type: "text"; text: string };

    const fileBlock: ContentBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } }
      : { type: "image", source: { type: "base64", media_type: imageMime, data: base64Data } };

    // Send to Claude vision (PDFs need the pdfs beta)
    const createParams = {
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user" as const, content: [fileBlock, { type: "text" as const, text: EXTRACT_PROMPT }] }],
      ...(isPdf ? { betas: ["pdfs-2024-09-25"] } : {}),
    };
    const response = await (isPdf
      ? anthropic.beta.messages.create(createParams as Parameters<typeof anthropic.beta.messages.create>[0])
      : anthropic.messages.create(createParams));

    const rawText = response.content[0].type === "text" ? response.content[0].text : "{}";
    let parsed: { markers?: Record<string, unknown>; test_date?: string; lab_name?: string; notes?: string };
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[analyze-blood-work] JSON parse failed:", rawText.slice(0, 200));
      parsed = { notes: "Could not parse extraction result" };
    }

    // Update blood_work row with extracted data
    const { error: updateErr } = await supabase
      .from("blood_work")
      .update({
        markers: parsed.markers ?? {},
        test_date: parsed.test_date ?? null,
        extraction_notes: parsed.notes ?? null,
      })
      .eq("id", bloodWorkId);

    if (updateErr) console.error("[analyze-blood-work] DB update error:", updateErr);

    return new Response(
      JSON.stringify({ success: true, markers: parsed.markers, test_date: parsed.test_date }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze-blood-work] FATAL:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
