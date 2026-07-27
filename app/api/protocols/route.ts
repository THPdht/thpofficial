import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin, requireAdmin, requireSelfOrAdmin } from '@/lib/apiAuth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const all = searchParams.get('all') === '1'; // admin mode — returns drafts too

  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  const denied = await requireSelfOrAdmin(req, email);
  if (denied) return denied;

  // Drafts are THP's working copies. A client asking for all=1 gets sent protocols
  // only — the flag is not a way for them to read what has not been sent yet.
  const includeDrafts = all && isAdmin(req);

  let query = supabaseAdmin
    .from('protocols')
    .select('*')
    .eq('user_email', email)
    .order('stage', { ascending: true });

  if (!includeDrafts) {
    query = query.eq('status', 'sent');
  }

  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ protocols: data ?? [] });
}

// DELETE — discard a draft protocol. Drafts only: once a protocol is sent the client
// can see it in their portal, and pulling it out from under them is not a delete.
export async function DELETE(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { protocolId } = await req.json();
  if (!protocolId) return Response.json({ error: 'Missing protocolId' }, { status: 400 });

  const { data: protocol } = await supabaseAdmin
    .from('protocols')
    .select('id, status')
    .eq('id', protocolId)
    .maybeSingle();

  if (!protocol) return Response.json({ error: 'Protocol not found' }, { status: 404 });
  if (protocol.status === 'sent' || protocol.status === 'active') {
    return Response.json({ error: 'This protocol has already been sent to the client.' }, { status: 400 });
  }

  const { error: delError } = await supabaseAdmin.from('protocols').delete().eq('id', protocolId);
  if (delError) return Response.json({ error: delError.message }, { status: 500 });

  return Response.json({ success: true });
}
