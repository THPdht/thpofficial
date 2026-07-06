/**
 * Called from /onboarding on form submit.
 * Saves intake form data to users.diagnostic_data and marks the client as pending.
 * Protocol generation is NOT triggered here — THP does that manually from admin when ready.
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { email, formData, token } = await req.json();
    if (!email || !formData) {
      return Response.json({ error: 'Missing email or formData' }, { status: 400 });
    }

    // Fetch current user record for name and status
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('status, name')
      .eq('email', email)
      .single();
    const newStatus = (existing?.status === 'new' || !existing?.status) ? 'pending' : existing.status;
    const clientName = existing?.name ?? email.split('@')[0];

    // Save intake form data to user record
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ diagnostic_data: formData, status: newStatus })
      .eq('email', email);
    if (updateError) {
      console.error('[generate-onboarding-protocol] failed to save diagnostic_data:', updateError);
      return Response.json({ error: 'Failed to save intake data' }, { status: 500 });
    }

    // Mark invite token as used if provided
    if (token) {
      await supabaseAdmin.from('invites').update({ used: true }).eq('token', token);
    }

    // Insert intake_submitted alarm for admin feed
    const { error: alarmErr } = await supabaseAdmin.from('alarms').insert({
      user_email: email,
      type: 'intake_submitted',
      message: `${clientName} submitted intake — Phase 1 protocol auto-generating now`,
      created_at: new Date().toISOString(),
    });
    if (alarmErr) console.error('[generate-onboarding-protocol] alarm insert failed:', alarmErr);

    // Auto-generate Phase 1 protocol (fire-and-forget — don't block the response)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thpofficial.com';
    fetch(`${appUrl}/api/generate-protocol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientEmail: email, phase1Mode: true }),
    }).catch(e => console.error('[generate-onboarding-protocol] auto protocol generation failed:', e));

    return Response.json({ success: true });
  } catch (err) {
    console.error('[generate-onboarding-protocol]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
