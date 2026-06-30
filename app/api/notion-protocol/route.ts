import { Client as NotionClient } from '@notionhq/client';

type ProtocolBlock =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'divider' }
  | { type: 'todo'; text: string; checked: boolean };

function extractText(richText: unknown[]): string {
  if (!Array.isArray(richText)) return '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return richText.map((t: any) => t?.plain_text || t?.text?.content || '').join('');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');
    if (!pageId) return Response.json({ error: 'Missing pageId' }, { status: 400 });

    const notionToken = process.env.NOTION_TOKEN;
    if (!notionToken) return Response.json({ error: 'NOTION_TOKEN not set' }, { status: 500 });

    const notion = new NotionClient({ auth: notionToken });

    // Fetch page title
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await notion.pages.retrieve({ page_id: pageId }) as any;
    const titleProp = page?.properties?.title?.title || page?.properties?.Name?.title || [];
    const pageTitle: string = titleProp.map((t: { plain_text?: string }) => t?.plain_text || '').join('') || '';

    // Fetch all blocks (paginate if needed)
    const blocks: ProtocolBlock[] = [];
    let cursor: string | undefined = undefined;

    do {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });

      for (const block of response.results) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = block as any;
        const type = b.type;

        if (type === 'heading_2') {
          blocks.push({ type: 'heading', level: 2, text: extractText(b.heading_2?.rich_text || []) });
        } else if (type === 'heading_3') {
          blocks.push({ type: 'heading', level: 3, text: extractText(b.heading_3?.rich_text || []) });
        } else if (type === 'paragraph') {
          const text = extractText(b.paragraph?.rich_text || []);
          if (text.trim()) blocks.push({ type: 'paragraph', text });
        } else if (type === 'divider') {
          blocks.push({ type: 'divider' });
        } else if (type === 'to_do') {
          const text = extractText(b.to_do?.rich_text || []);
          if (text.trim()) blocks.push({ type: 'todo', text, checked: b.to_do?.checked ?? false });
        }
      }

      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);

    return Response.json({ blocks, pageTitle });
  } catch (err) {
    console.error('[notion-protocol]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
