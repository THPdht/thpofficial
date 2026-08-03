/**
 * Send THP a test notification.
 *
 * Push failing is invisible by design: the browser reports "permission granted"
 * whether or not the subscription ever reached us, so the only way to know it
 * works is to send one. This also reports how many admin devices are registered,
 * which turns "I'm not getting notifications" into a number.
 */

import { requireAdmin } from '@/lib/apiAuth';
import { pushAdmin } from '@/lib/notifyAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { count } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint', { count: 'exact', head: true })
    .eq('is_admin', true);

  const devices = count ?? 0;
  if (devices === 0) {
    return Response.json({
      ok: false,
      devices: 0,
      message: 'This device is not registered yet. Turn notifications on above, then try again.',
    });
  }

  await pushAdmin('THP', 'Test notification. Notifications are working.');

  return Response.json({
    ok: true,
    devices,
    message: `Sent to ${devices} device${devices === 1 ? '' : 's'}. If nothing arrives, this device is not one of them.`,
  });
}
