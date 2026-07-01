/**
 * Called from /onboarding on form submit.
 * 1. Saves intake form data to users.diagnostic_data
 * 2. Marks invite token as used (if provided)
 * 3. Delegates AI generation to /api/generate-protocol
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { email, formData, token } = await req.json();
    if (!email || !formData) {
      return Response.json({ error: 'Missing email or formData' }, { status: 400 });
    }

    // 1. Save intake form data to user record
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ diagnostic_data: formData })
      .eq('email', email);
    if (updateError) {
      console.error('[generate-onboarding-protocol] failed to save diagnostic_data:', updateError);
      return Response.json({ error: 'Failed to save intake data' }, { status: 500 });
    }

    // 2. Mark invite token as used
    if (token) {
      await supabaseAdmin.from('invites').update({ used: true }).eq('token', token);
    }

    // 3. Call generate-protocol which reads diagnostic_data and runs the AI
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thpofficial.com';
    const res = await fetch(`${appUrl}/api/generate-protocol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientEmail: email }),
    });

    if (!res.ok) {
      let errMsg = 'Protocol generation failed';
      try { const body = await res.json(); errMsg = body.error ?? errMsg; } catch { /* ignore */ }
      console.error('[generate-onboarding-protocol] generate-protocol failed:', errMsg);
      return Response.json({ error: errMsg }, { status: 500 });
    }

    const data = await res.json();
    return Response.json({ success: true, ...data });
  } catch (err) {
    console.error('[generate-onboarding-protocol]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
