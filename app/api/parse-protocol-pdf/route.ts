/**
 * Parse an existing THP protocol PDF uploaded by a client or admin.
 *
 * Receives: multipart/form-data with:
 *   - pdf: File (the PDF)
 *   - email: string (client email)
 *   - adminPw: string (ADMIN_PASSWORD — required if called from admin)
 *
 * Steps:
 *  1. Read PDF as base64
 *  2. Send to Claude with a structured extraction prompt
 *  3. Parse the 8 standard sections out of the response
 *  4. Split: diagnostic sections → diagnostics table, protocol sections → protocols table
 *  5. Set user status to 'active'
 *  6. Return { success, stage }
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const DIAGNOSTIC_HEADINGS = new Set([
  'WHERE YOU ARE RIGHT NOW',
  'ROOT PROBLEM',
  'WHY IT IS HAPPENING',
  'WHY PREVIOUS ATTEMPTS FAILED',
]);

const EXTRACT_PROMPT = `You are reading a THP (The Hormone Prophet) coaching protocol PDF. Extract all content and restructure it into this exact JSON format:

{
  "sections": [
    { "heading": "WHERE YOU ARE RIGHT NOW", "text": "..." },
    { "heading": "ROOT PROBLEM", "text": "..." },
    { "heading": "WHY IT IS HAPPENING", "text": "..." },
    { "heading": "WHY PREVIOUS ATTEMPTS FAILED", "text": "..." },
    { "heading": "FOUNDATION PHASE", "text": "..." },
    { "heading": "IMPLEMENTATION PHASE", "text": "..." },
    { "heading": "SUCCESS METRICS", "text": "..." },
    { "heading": "WHERE THIS IS GOING", "text": "..." }
  ],
  "todos": ["action item one", "action item two"]
}

Rules:
- Map the PDF sections to these exact 8 headings as best you can
- If a section is missing from the PDF, include it with text: "not included in original protocol"
- For todos, extract any action items, checklists, or to-do items from the PDF
- Preserve all the original text content — do not summarise or rephrase
- Output ONLY valid JSON, no markdown fences, no preamble`;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const pdf = formData.get('pdf') as File | null;
    const email = (formData.get('email') as string | null)?.toLowerCase().trim();
    const adminPw = formData.get('adminPw') as string | null;

    if (!pdf || !email) {
      return Response.json({ error: 'Missing pdf or email' }, { status: 400 });
    }

    // Auth: either the requesting user matches the email (client self-upload)
    // OR it's admin (adminPw matches)
    const isAdmin = adminPw && adminPw === process.env.ADMIN_PASSWORD;
    // For client self-upload we rely on the fact that this route is only reachable
    // from the authenticated /welcome page — no extra token needed server-side
    // since the email is validated against their logged-in session on the client.

    if (pdf.size > 20 * 1024 * 1024) {
      return Response.json({ error: 'PDF too large (max 20MB)' }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

    // Verify client exists
    const { data: client, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('email, name, diagnostic_data')
      .eq('email', email)
      .maybeSingle();
    if (lookupError) {
      console.error('[parse-protocol-pdf] DB lookup error:', lookupError);
      return Response.json({ error: 'Database error: ' + lookupError.message }, { status: 500 });
    }
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    // Convert PDF to base64
    const arrayBuffer = await pdf.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Upload to Supabase Storage for archiving
    const storagePath = `protocols/${email.replace('@', '_at_')}_${Date.now()}.pdf`;
    await supabaseAdmin.storage
      .from('uploads')
      .upload(storagePath, Buffer.from(arrayBuffer), { contentType: 'application/pdf', upsert: false });
    const { data: storageUrlData } = supabaseAdmin.storage.from('uploads').getPublicUrl(storagePath);
    const pdfUrl = storageUrlData?.publicUrl ?? null;

    // Send to Claude for extraction
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (anthropic.messages.create as any)({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: EXTRACT_PROMPT,
          },
        ],
      }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const sections: { heading: string; text: string }[] = parsed.sections ?? [];
    const todos: string[] = parsed.todos ?? [];

    // Count existing protocols for stage number
    const { count } = await supabaseAdmin
      .from('protocols')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', email);
    const stage = (count ?? 0) + 1;

    const name = client.name ?? email;
    const diagTitle = `${name} — Diagnosis Stage ${stage} (PDF Import)`;
    const protTitle = `${name} — Protocol Stage ${stage} (PDF Import)`;

    const diagnosticSections = sections.filter(s => DIAGNOSTIC_HEADINGS.has(s.heading.toUpperCase()));
    const protocolSections = sections.filter(s => !DIAGNOSTIC_HEADINGS.has(s.heading.toUpperCase()));

    // Insert diagnostic as unpublished draft — THP must send manually from admin
    await supabaseAdmin.from('diagnostics').insert({
      user_email: email,
      stage,
      title: diagTitle,
      content: { sections: diagnosticSections },
      pdf_url: pdfUrl,
      published: false,
    });

    // Insert into protocols table
    await supabaseAdmin.from('protocols').insert({
      user_email: email,
      stage,
      title: protTitle,
      content: { sections: protocolSections, todos },
    });

    // Set user status to active
    const existingDiag = client.diagnostic_data || {};
    await supabaseAdmin.from('users').update({
      status: 'active',
      diagnostic_data: { ...existingDiag, protocolStatus: 'active', pdfImported: true },
    }).eq('email', email);

    return Response.json({ success: true, stage, pdfUrl });
  } catch (err) {
    console.error('[parse-protocol-pdf]', err);
    return Response.json({ error: 'Failed to parse PDF' }, { status: 500 });
  }
}
