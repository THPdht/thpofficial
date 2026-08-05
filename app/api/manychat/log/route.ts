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

  return Response.json({ decisions: data ?? [] });
}
