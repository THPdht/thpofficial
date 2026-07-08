import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/protocol-todos?email=&protocol_id=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email')?.toLowerCase().trim();
  const protocolId = searchParams.get('protocol_id');

  if (!email || !protocolId) {
    return Response.json({ error: 'Missing email or protocol_id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('protocol_todos')
    .select('item_idx, checked, checked_at')
    .eq('user_email', email)
    .eq('protocol_id', protocolId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const checked: number[] = [];
  const checkedAt: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.checked) {
      checked.push(row.item_idx);
      if (row.checked_at) checkedAt[String(row.item_idx)] = row.checked_at;
    }
  }

  return Response.json({ checked, checked_at: checkedAt });
}

// POST /api/protocol-todos
// Body: { email, protocol_id, item_idx, checked }
export async function POST(req: Request) {
  const { email: rawEmail, protocol_id, item_idx, checked } = await req.json();
  const email = rawEmail?.toLowerCase().trim();

  if (!email || !protocol_id || item_idx === undefined || checked === undefined) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('protocol_todos')
    .upsert({
      user_email: email,
      protocol_id,
      item_idx,
      checked,
      checked_at: checked ? new Date().toISOString() : null,
    }, { onConflict: 'user_email,protocol_id,item_idx' });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
