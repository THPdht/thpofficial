import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { diagnosisId } = await req.json();
    if (!diagnosisId) return Response.json({ error: 'Missing diagnosisId' }, { status: 400 });

    // Fetch diagnosis to get user_email
    const { data: diagnosis, error: fetchErr } = await supabaseAdmin
      .from('diagnostics')
      .select('id, user_email, title')
      .eq('id', diagnosisId)
      .maybeSingle();

    if (fetchErr || !diagnosis) {
      return Response.json({ error: 'Diagnosis not found' }, { status: 404 });
    }

    // Publish the diagnosis
    await supabaseAdmin
      .from('diagnostics')
      .update({ published: true })
      .eq('id', diagnosisId);

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
        userEmail: diagnosis.user_email,
        title: 'Your diagnosis is ready',
        body: 'THP has sent your diagnosis. Tap to read it.',
        url: `${appUrl}/dashboard?tab=diagnosis`,
      }),
    }).catch((err) => console.error('[diagnosis-send] push failed:', err));

    return Response.json({ success: true });
  } catch (err) {
    console.error('[diagnosis-send]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
