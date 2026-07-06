/**
 * Parse an existing THP protocol from a Notion page URL.
 *
 * Receives JSON body: { notionUrl: string, email: string }
 *
 * Steps:
 *  1. Extract Notion page ID from URL
 *  2. Fetch all blocks from the page via Notion API
 *  3. Convert blocks to plain text
 *  4. Send to Claude with the same structured extraction prompt as parse-protocol-pdf
 *  5. Split: diagnostic sections → diagnostics table, protocol sections → protocols table
 *  6. Set user status to 'active'
 *  7. Return { success, stage }
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const DIAGNOSTIC_HEADINGS = new Set([
  'WHERE YOU ARE RIGHT NOW',
  'ROOT PROBLEM',
  'WHY IT IS HAPPENING',
  'WHY PREVIOUS ATTEMPTS FAILED',
]);

const EXTRACT_PROMPT = `You are reading a THP (The Hormone Prophet) coaching protocol. Extract all content and restructure it into this exact JSON format:

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

function extractPageId(url: string): string | null {
  // Handle formats:
  // https://www.notion.so/Page-Title-abc123def456...
  // https://notion.so/workspace/Page-Title-abc123def456
  // Just a 32-char hex ID
  const cleanUrl = url.trim();

  // Direct 32-char hex
  if (/^[a-f0-9]{32}$/i.test(cleanUrl)) return cleanUrl;

  // Extract last 32-char hex segment from URL path
  const match = cleanUrl.match(/([a-f0-9]{32})(?:[?#]|$)/i);
  if (match) return match[1];

  // Handle dashed UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidMatch = cleanUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (uuidMatch) return uuidMatch[1].replace(/-/g, '');

  return null;
}

interface NotionRichText {
  plain_text?: string;
}

interface NotionBlock {
  type: string;
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  toggle?: { rich_text: NotionRichText[] };
  quote?: { rich_text: NotionRichText[] };
  callout?: { rich_text: NotionRichText[] };
  has_children?: boolean;
  id?: string;
}

function blockToText(block: NotionBlock): string {
  const type = block.type;
  const content = (block as unknown as Record<string, { rich_text?: NotionRichText[] }>)[type];
  if (!content?.rich_text) return '';
  const text = content.rich_text.map((rt: NotionRichText) => rt.plain_text ?? '').join('');
  if (type === 'heading_1') return `\n# ${text}\n`;
  if (type === 'heading_2') return `\n## ${text}\n`;
  if (type === 'heading_3') return `\n### ${text}\n`;
  if (type === 'bulleted_list_item') return `• ${text}`;
  if (type === 'numbered_list_item') return `- ${text}`;
  return text;
}

async function fetchAllBlocks(pageId: string, notionToken: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Notion API error ${res.status}: ${(err as { message?: string }).message ?? res.statusText}`);
    }
    const data = await res.json() as { results: NotionBlock[]; has_more: boolean; next_cursor?: string };
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  // Recursively fetch children for toggle/column blocks
  for (const block of blocks) {
    if (block.has_children && block.id && ['toggle', 'column_list', 'column'].includes(block.type)) {
      const children = await fetchAllBlocks(block.id, notionToken);
      blocks.push(...children);
    }
  }

  return blocks;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { notionUrl?: string; email?: string };
    const notionUrl = body.notionUrl?.trim();
    const email = body.email?.toLowerCase().trim();

    if (!notionUrl || !email) {
      return Response.json({ error: 'Missing notionUrl or email' }, { status: 400 });
    }

    const notionToken = process.env.NOTION_TOKEN;
    if (!notionToken) return Response.json({ error: 'NOTION_TOKEN not configured' }, { status: 500 });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

    const pageId = extractPageId(notionUrl);
    if (!pageId) {
      return Response.json({ error: 'Could not extract a Notion page ID from that URL. Make sure the link is a valid Notion page.' }, { status: 400 });
    }

    // Verify client exists
    const { data: client, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('email, name, diagnostic_data')
      .eq('email', email)
      .maybeSingle();
    if (lookupError) return Response.json({ error: 'Database error: ' + lookupError.message }, { status: 500 });
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    // Fetch Notion page blocks
    let blocks;
    try {
      blocks = await fetchAllBlocks(pageId, notionToken);
    } catch (notionErr) {
      const msg = notionErr instanceof Error ? notionErr.message : '';
      if (msg.includes('404')) {
        return Response.json({
          error: 'This Notion page isn\'t accessible. In Notion, open the page, click Share, and add the "THP Intake Automation" integration. Then try again.',
        }, { status: 400 });
      }
      throw notionErr;
    }
    const pageText = blocks.map(blockToText).filter(Boolean).join('\n');

    if (!pageText.trim()) {
      return Response.json({ error: 'Could not read any content from that Notion page. Make sure it is shared publicly or the token has access.' }, { status: 400 });
    }

    // Send to Claude for extraction
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `${EXTRACT_PROMPT}\n\nHere is the protocol content:\n\n${pageText}`,
      }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned) as { sections: { heading: string; text: string }[]; todos?: string[] };
    const sections = parsed.sections ?? [];
    const todos: string[] = parsed.todos ?? [];

    // Count existing protocols for stage number
    const { count } = await supabaseAdmin
      .from('protocols')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', email);
    const stage = (count ?? 0) + 1;

    const name = client.name ?? email;
    const diagTitle = `${name} — Diagnosis Stage ${stage} (Notion Import)`;
    const protTitle = `${name} — Protocol Stage ${stage} (Notion Import)`;

    const diagnosticSections = sections.filter(s => DIAGNOSTIC_HEADINGS.has(s.heading.toUpperCase()));
    const protocolSections = sections.filter(s => !DIAGNOSTIC_HEADINGS.has(s.heading.toUpperCase()));

    await supabaseAdmin.from('diagnostics').insert({
      user_email: email,
      stage,
      title: diagTitle,
      content: { sections: diagnosticSections },
      published: false,
    });

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
    console.error('[parse-protocol-notion]', err);
    const msg = err instanceof Error ? err.message : 'Failed to import Notion page';
    return Response.json({ error: msg }, { status: 500 });
  }
}
