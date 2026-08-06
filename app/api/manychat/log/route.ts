/**
 * The Instagram decision log — read-only.
 *
 * ManyChat runs the automation. The site answers one question per conversation
 * (/api/manychat/qualify) and writes down what it decided. This route hands
 * those decisions to the admin panel and does nothing else.
 *
 * There is deliberately no PATCH and no POST. The panel this feeds used to hold
 * switches for a bot the site no longer runs, and a switch that changes nothing
 * is worse than no switch: ManyChat is the only place the automation is turned
 * on or off, so nothing here can disagree with it.
 *
 * Admin-only: these rows contain what real people said about themselves.
 */

import { requireAdmin } from '@/lib/apiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('ig_qualifications')
    .select('id, ig_username, raw_text, age, work_status, country, country_tier, marital, status, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Follow-ups are a separate list, not extra decisions: they are people the
  // automation has finished with who wrote back, waiting on Ali rather than on
  // the flow. A missing ig_followups table (the SQL not yet run) must not take
  // the decision log down with it, so this failure is swallowed.
  // `kind` arrives in a hand-run migration, so ask for it and fall back to the
  // older shape rather than showing an empty panel while the two disagree.
  let followups: unknown[] = [];
  const withKind = await supabaseAdmin
    .from('ig_followups')
    .select('id, ig_username, message, handled, kind, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!withKind.error) {
    followups = withKind.data ?? [];
  } else {
    const legacy = await supabaseAdmin
      .from('ig_followups')
      .select('id, ig_username, message, handled, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (legacy.error) console.error('[manychat/log] followups unavailable:', legacy.error.message);
    else followups = legacy.data ?? [];
  }

  return Response.json({ decisions: data ?? [], followups });
}
