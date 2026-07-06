/**
 * Parse an existing THP protocol from one or more screenshots.
 * Client uploads images of their Notion page; Claude vision extracts the content.
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const DIAGNOSTIC_HEADINGS = new Set([
  'WHERE YOU ARE RIGHT NOW',
  'ROOT PROBLEM',
  'WHY IT IS HAPPENING',
  'WHY PREVIOUS ATTEMPTS FAILED',
]);

const EXTRACT_PROMPT = `You are reading screenshots of a THP (The Hormone Prophet) coaching protocol. Extract all content and restructure it into this exact JSON format:

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
- Map the content sections to these exact 8 headings as best you can
- If a section is missing, include it with text: "not included in original protocol"
- For todos, extract any action items, checklists, or to-do items
- Preserve all the original text content — do not summarise or rephrase
- Output ONLY valid JSON, no markdown fences, no preamble`;

// Chunked base64 to avoid call stack overflow on large files
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 4096;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const email = (formData.get('email') as string | null)?.toLowerCase().trim();
    const files = formData.getAll('files') as File[];

    if (!email || files.length === 0) {
      return Response.json({ error: 'Missing email or files' }, { status: 400 });
    }
    if (files.length > 10) {
      return Response.json({ error: 'Maximum 10 screenshots at a time' }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

    const { data: client, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('email, name, diagnostic_data')
      .eq('email', email)
      .maybeSingle();
    if (lookupError) return Response.json({ error: 'Database error: ' + lookupError.message }, { status: 500 });
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    // Build Claude message with all images
    type SupportedMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    type ImageBlock = {
      type: 'image';
      source: { type: 'base64'; media_type: SupportedMime; data: string };
    };
    type TextBlock = { type: 'text'; text: string };
    const content: (ImageBlock | TextBlock)[] = [];

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const rawMime = file.type || 'image/jpeg';
      const mimeType: SupportedMime = rawMime === 'image/png' ? 'image/png'
        : rawMime === 'image/gif' ? 'image/gif'
        : rawMime === 'image/webp' ? 'image/webp'
        : 'image/jpeg';
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64 },
      });
    }
    content.push({ type: 'text', text: EXTRACT_PROMPT });

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned) as { sections: { heading: string; text: string }[]; todos?: string[] };
    const sections = parsed.sections ?? [];
    const todos: string[] = parsed.todos ?? [];

    const { count } = await supabaseAdmin
      .from('protocols')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', email);
    const stage = (count ?? 0) + 1;

    const name = client.name ?? email;
    const diagTitle = `${name} — Diagnosis (Screenshot Import)`;
    const protTitle = `${name} — Protocol Stage ${stage} (Screenshot Import)`;

    const diagnosticSections = sections.filter(s => DIAGNOSTIC_HEADINGS.has(s.heading.toUpperCase()));
    const protocolSections = sections.filter(s => !DIAGNOSTIC_HEADINGS.has(s.heading.toUpperCase()));

    await supabaseAdmin.from('diagnostics').upsert(
      { user_email: email, stage: 1, title: diagTitle, content: { sections: diagnosticSections }, published: false },
      { onConflict: 'user_email' }
    );

    await supabaseAdmin.from('protocols').insert({
      user_email: email,
      stage,
      title: protTitle,
      content: { sections: protocolSections, todos },
    });

    const existingDiag = client.diagnostic_data || {};
    await supabaseAdmin.from('users').update({
      status: 'active',
      diagnostic_data: { ...existingDiag, protocolStatus: 'active', pdfImported: true },
    }).eq('email', email);

    return Response.json({ success: true, stage });
  } catch (err) {
    console.error('[parse-protocol-screenshots]', err);
    const msg = err instanceof Error ? err.message : 'Failed to process screenshots';
    return Response.json({ error: msg }, { status: 500 });
  }
}
