/**
 * Parse an existing THP protocol from a Notion page URL.
 *
 * Supports publicly shared pages (app.notion.com/p/... or notion.so/...)
 * without requiring the page to be shared with an integration.
 * Falls back to integration token for private workspace pages.
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
  const cleanUrl = url.trim();
  if (/^[a-f0-9]{32}$/i.test(cleanUrl)) return cleanUrl;
  const match = cleanUrl.match(/([a-f0-9]{32})(?:[?#]|$)/i);
  if (match) return match[1];
  const uuidMatch = cleanUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (uuidMatch) return uuidMatch[1].replace(/-/g, '');
  return null;
}

function toUuid(hex: string): string {
  if (hex.includes('-')) return hex;
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

interface LoadPageChunkBlockValue {
  id: string;
  type: string;
  properties?: { title?: string[][] };
  content?: string[];
}

interface LoadPageChunkResponse {
  recordMap: {
    // API wraps block data in an extra { value: { value: ... } } envelope
    block: Record<string, { value: { value?: LoadPageChunkBlockValue } & LoadPageChunkBlockValue }>;
  };
}

// Fetch any publicly shared Notion page without requiring integration permissions
async function fetchPublicPageText(pageId: string): Promise<string> {
  const uuidPageId = toUuid(pageId);

  const res = await fetch('https://www.notion.so/api/v3/loadPageChunk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Origin': 'https://www.notion.so',
      'Referer': `https://www.notion.so/${uuidPageId.replace(/-/g, '')}`,
      'Accept-Language': 'en-US,en;q=0.9',
    },
    body: JSON.stringify({
      pageId: uuidPageId,
      limit: 300,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`public_fetch_failed:${res.status}`);
  }

  const data = await res.json() as LoadPageChunkResponse;
  const blocks = data.recordMap?.block ?? {};
  // API wraps block in { value: { value: {...} } } — unwrap the extra level
  const rootBlockRaw = blocks[uuidPageId]?.value;
  const rootBlock: LoadPageChunkBlockValue | undefined = rootBlockRaw?.value ?? (rootBlockRaw as unknown as LoadPageChunkBlockValue | undefined);
  if (!rootBlock) throw new Error('public_fetch_failed:no_root');

  function blockText(id: string): string {
    const wrapper = blocks[id]?.value;
    const b: LoadPageChunkBlockValue | undefined = wrapper?.value ?? (wrapper as unknown as LoadPageChunkBlockValue | undefined);
    if (!b) return '';
    const raw = (b.properties?.title ?? []).map((t: string[]) => t[0] ?? '').join('');
    let line = '';
    if (b.type === 'header') line = `\n# ${raw}\n`;
    else if (b.type === 'sub_header') line = `\n## ${raw}\n`;
    else if (b.type === 'sub_sub_header') line = `\n### ${raw}\n`;
    else if (b.type === 'bulleted_list') line = `• ${raw}`;
    else if (b.type === 'numbered_list') line = `- ${raw}`;
    else if (b.type === 'quote') line = `> ${raw}`;
    else if (b.type === 'divider') line = '\n---\n';
    else line = raw;
    const children = (b.content ?? []).map(blockText).filter(Boolean).join('\n');
    return [line, children].filter(Boolean).join('\n');
  }

  return (rootBlock.content ?? []).map(blockText).filter(Boolean).join('\n');
}

// Fallback 2: fetch page HTML and strip tags — works for Notion Sites (app.notion.com/p/) and any public URL
async function fetchPageHtmlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`html_fetch:${res.status}`);
  const html = await res.text();
  // Strip scripts, styles, then all tags; decode basic HTML entities
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 200) throw new Error('html_fetch:too_short');
  return text;
}

// Fallback 3: fetch via official Notion API (requires page shared with integration)
interface NotionRichText { plain_text?: string; }
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

async function fetchTokenPageText(pageId: string, notionToken: string): Promise<string> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${notionToken}`, 'Notion-Version': '2022-06-28' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Notion API error ${res.status}: ${(err as { message?: string }).message ?? res.statusText}`);
    }
    const data = await res.json() as { results: NotionBlock[]; has_more: boolean; next_cursor?: string };
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return blocks.map(blockToText).filter(Boolean).join('\n');
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { notionUrl?: string; email?: string };
    const notionUrl = body.notionUrl?.trim();
    const email = body.email?.toLowerCase().trim();

    if (!notionUrl || !email) {
      return Response.json({ error: 'Missing notionUrl or email' }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

    const pageId = extractPageId(notionUrl);
    if (!pageId) {
      return Response.json({ error: 'Could not extract a Notion page ID from that URL.' }, { status: 400 });
    }

    const { data: client, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('email, name, diagnostic_data')
      .eq('email', email)
      .maybeSingle();
    if (lookupError) return Response.json({ error: 'Database error: ' + lookupError.message }, { status: 500 });
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    // Strategy 1: loadPageChunk (works for standard "Share to web" notion.so pages)
    let pageText = '';
    let fetchError = '';
    try {
      pageText = await fetchPublicPageText(pageId);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : 'unknown';
    }

    // Strategy 2: HTML scrape (works for Notion Sites — app.notion.com/p/ — and any public URL)
    if (!pageText.trim()) {
      try {
        pageText = await fetchPageHtmlText(notionUrl);
      } catch (e) {
        fetchError = e instanceof Error ? e.message : 'unknown';
      }
    }

    // Strategy 3: official Notion API token (requires page shared with integration)
    if (!pageText.trim()) {
      const notionToken = process.env.NOTION_TOKEN;
      if (notionToken) {
        try {
          pageText = await fetchTokenPageText(pageId, notionToken);
        } catch (e) {
          fetchError = e instanceof Error ? e.message : 'unknown';
        }
      }
    }

    if (!pageText.trim()) {
      console.error('[parse-protocol-notion] all fetch strategies failed. fetchError:', fetchError, 'pageId:', pageId, 'url:', notionUrl);
      return Response.json({
        error: 'Could not read this Notion page. Make sure the page is publicly accessible — open it in Notion, go to Share, and confirm "Share to web" or "Publish" is turned on.',
        debug: fetchError || 'no_error_but_empty',
      }, { status: 400 });
    }

    // Send to Claude for extraction
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: `${EXTRACT_PROMPT}\n\nHere is the protocol content:\n\n${pageText}` }],
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
    const diagTitle = `${name} — Diagnosis (Notion Import)`;
    const protTitle = `${name} — Protocol Stage ${stage} (Notion Import)`;

    const diagnosticSections = sections.filter(s => DIAGNOSTIC_HEADINGS.has(s.heading.toUpperCase()));
    const protocolSections = sections.filter(s => !DIAGNOSTIC_HEADINGS.has(s.heading.toUpperCase()));

    // Upsert diagnosis (singular — overwrites if already exists)
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
    console.error('[parse-protocol-notion]', err);
    const msg = err instanceof Error ? err.message : 'Failed to import Notion page';
    return Response.json({ error: msg }, { status: 500 });
  }
}
