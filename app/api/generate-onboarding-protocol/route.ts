/**
 * Called from /onboarding on form submit.
 * Saves intake form data to users.diagnostic_data and marks the client as pending.
 * Protocol generation is NOT triggered here — THP does that manually from admin when ready.
 */

import { after } from 'next/server';
import { callerEmail, isAdmin } from '@/lib/apiAuth';
import { notifyAdmin } from '@/lib/notifyAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Prove the caller is this client, or admin.
 *
 * This route writes a client's whole intake, and until now took an email and a
 * payload from anyone at all: knowing a client's email address was enough to
 * overwrite or destroy the 40 answers every one of their protocols is built from.
 *
 * A signed-in token is preferred, but the inline register/login path on
 * /onboarding never establishes a browser session, so the account password is
 * accepted too — the same approach /api/push-subscribe already uses. Requiring
 * only a token here would lock real clients out of finishing their intake.
 */
async function authorised(req: Request, email: string, password: unknown): Promise<boolean> {
  if (isAdmin(req)) return true;

  const caller = await callerEmail(req);
  if (caller && caller === email) return true;

  if (typeof password === 'string' && password) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('password')
      .eq('email', email)
      .maybeSingle();
    if (data?.password && data.password === password) return true;
  }

  return false;
}

export async function POST(req: Request) {
  try {
    const { email: rawEmail, formData, token, password } = await req.json();
    if (!rawEmail || !formData) {
      return Response.json({ error: 'Missing email or formData' }, { status: 400 });
    }

    const email = String(rawEmail).toLowerCase().trim();
    if (!(await authorised(req, email, password))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch current user record for name and status
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('status, name, diagnostic_data')
      .eq('email', email)
      .single();
    const newStatus = (existing?.status === 'new' || !existing?.status) ? 'pending' : existing.status;
    const clientName = existing?.name ?? email.split('@')[0];

    // Merge rather than replace. Anything the client saved outside this form, such
    // as the Instagram handle added later from the dashboard, would otherwise be
    // wiped every time they resubmitted their intake.
    const previous = (existing?.diagnostic_data as Record<string, unknown>) ?? {};
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ diagnostic_data: { ...previous, ...formData }, status: newStatus })
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
    await notifyAdmin(email, 'intake_submitted', `${clientName} submitted their intake — building diagnosis now`);

    // Auto-generate DIAGNOSIS after response is sent — use after() so Vercel keeps function alive
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thpofficial.com';
    after(async () => {
      try {
        const res = await fetch(`${appUrl}/api/generate-diagnosis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientEmail: email, adminPw: process.env.ADMIN_PASSWORD }),
        });
        if (!res.ok) console.error('[generate-onboarding-protocol] auto diagnosis generation returned', res.status, await res.text());
      } catch (e) {
        console.error('[generate-onboarding-protocol] auto diagnosis generation failed:', e);
      }
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error('[generate-onboarding-protocol]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
