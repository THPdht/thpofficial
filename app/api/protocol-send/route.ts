import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { protocolId } = await req.json();
    if (!protocolId) return Response.json({ error: 'Missing protocolId' }, { status: 400 });

    // Fetch protocol to get user_email and title
    const { data: protocol, error: fetchErr } = await supabaseAdmin
      .from('protocols')
      .select('id, user_email, title')
      .eq('id', protocolId)
      .maybeSingle();

    if (fetchErr || !protocol) {
      return Response.json({ error: 'Protocol not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Mark as sent so client can now see it
    await supabaseAdmin
      .from('protocols')
      .update({ status: 'sent', sent_at: now })
      .eq('id', protocolId);

    // Send push notification to the client
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thpofficial.com';
    const pushUrl = `${appUrl}/api/push-send`;
    fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? '',
      },
      body: JSON.stringify({
        userEmail: protocol.user_email,
        title: 'Your protocol is ready',
        body: 'THP has sent your monthly protocol. Tap to read it.',
        url: `${appUrl}/dashboard?tab=protocol`,
      }),
    }).catch((err) => console.error('[protocol-send] push failed:', err));

    return Response.json({ success: true });
  } catch (err) {
    console.error('[protocol-send]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
