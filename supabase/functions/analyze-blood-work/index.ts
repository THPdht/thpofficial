/**
 * analyze-blood-work — Supabase Edge Function
 *
 * Called after a client uploads a blood work image.
 * Downloads the image from Supabase Storage, sends to Gemini 2.5 Flash vision,
 * extracts hormone/health markers as structured JSON, updates the blood_work row.
 *
 * Invoke: supabase.functions.invoke('analyze-blood-work', { body: { bloodWorkId, imageUrl, userEmail } })
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Target hormone/health markers to extract
const TARGET_MARKERS = [
  "total_t",        // Total Testosterone (ng/dL or nmol/L)
  "free_t",         // Free Testosterone (pg/mL or pmol/L)
  "shbg",           // Sex Hormone Binding Globulin (nmol/L)
  "estradiol",      // Estradiol / E2 (pg/mL or pmol/L)
  "lh",             // Luteinizing Hormone (IU/L or mIU/mL)
  "fsh",            // Follicle Stimulating Hormone (IU/L or mIU/mL)
  "cortisol",       // Cortisol (mcg/dL or nmol/L)
  "hematocrit",     // Hematocrit (%)
  "hemoglobin",     // Hemoglobin (g/dL)
  "rbc",            // Red Blood Cell count
  "psa",            // PSA (ng/mL)
  "dhea_s",         // DHEA-S (mcg/dL or umol/L)
  "igf1",           // IGF-1 (ng/mL)
  "tsh",            // TSH - Thyroid Stimulating Hormone (mIU/L)
  "t3_free",        // Free T3 (pg/mL)
  "t4_free",        // Free T4 (ng/dL)
  "vitamin_d",      // Vitamin D 25-OH (ng/mL)
  "ferritin",       // Ferritin (ng/mL)
  "cholesterol",    // Total Cholesterol (mg/dL)
  "hdl",            // HDL (mg/dL)
  "ldl",            // LDL (mg/dL)
  "triglycerides",  // Triglycerides (mg/dL)
  "glucose",        // Fasting Glucose (mg/dL)
  "hba1c",          // HbA1c (%)
  "creatinine",     // Creatinine (mg/dL)
  "alt",            // ALT liver enzyme (U/L)
  "ast",            // AST liver enzyme (U/L)
];

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

    // Download image from Supabase Storage
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch image" }), { status: 400 });
    }
    const imageBuffer = await imageResp.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const mimeType = imageResp.headers.get("content-type") ?? "image/jpeg";

    const prompt = `You are reading a blood test / lab results panel image.

Extract ALL health markers you can see. Focus on these if present: ${TARGET_MARKERS.join(", ")}.

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

Use snake_case keys matching: ${TARGET_MARKERS.join(", ")}
For any additional markers not in the list, include them with their actual name as key.
If a value is not present in the image, omit it entirely.
JSON only, no markdown.`;

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Image } },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.1 },
    };

    const geminiResp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    const geminiData = await geminiResp.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    let parsed: { markers?: Record<string, unknown>; test_date?: string; notes?: string };
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { notes: "Could not parse extraction result" };
    }

    // Update blood_work row with extracted data
    await supabase
      .from("blood_work")
      .update({
        markers: parsed.markers ?? {},
        test_date: parsed.test_date ?? null,
        extraction_notes: parsed.notes ?? null,
      })
      .eq("id", bloodWorkId);

    return new Response(
      JSON.stringify({ success: true, markers: parsed.markers, test_date: parsed.test_date }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("[analyze-blood-work]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
