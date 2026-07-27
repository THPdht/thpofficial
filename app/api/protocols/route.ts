import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const all = searchParams.get('all') === '1'; // admin mode — returns drafts too

  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  let query = supabaseAdmin
    .from('protocols')
    .select('*')
    .eq('user_email', email)
    .order('stage', { ascending: true });

  if (!all) {
    query = query.eq('status', 'sent');
  }

  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ protocols: data ?? [] });
}

// DELETE — discard a draft protocol. Drafts only: once a protocol is sent the client
// can see it in their portal, and pulling it out from under them is not a delete.
export async function DELETE(req: Request) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
