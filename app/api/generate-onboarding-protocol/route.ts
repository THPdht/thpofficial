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

    // Fetch current status — only downgrade 'new' → 'pending', preserve 'active'/'alumni'
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('email', email)
      .single();
    const newStatus = (existing?.status === 'new' || !existing?.status) ? 'pending' : existing.status;

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

    return Response.json({ success: true });
  } catch (err) {
    console.error('[generate-onboarding-protocol]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
