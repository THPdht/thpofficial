import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Everything THP should know about goes through here.
 *
 * The alarms table is already the record of client activity and drives the
 * in-app feed in the Command Center. This raises the alarm exactly as before and
 * additionally pushes it to THP's phone.
 *
 * Push is best-effort. A failed notification must never stop the alarm being
 * written, or the feed would start losing events whenever a device goes stale.
 */

export type AdminAlarmType =
  | 'new_application'
  | 'new_referral'
  | 'referral_milestone'
  | 'protocol_ready'
  | 'protocol_imported'
  | 'diagnosis_ready'
  | 'intake_submitted'
  | 'blood_work_uploaded'
  | 'tracker_submitted'
  | 'new_message'
  | 'payment_received';

/** Short push titles. The alarm message carries the detail. */
const TITLES: Record<AdminAlarmType, string> = {
  new_application: 'New application',
  new_referral: 'New referral',
  referral_milestone: 'Referral milestone',
  protocol_ready: 'Protocol ready to review',
  protocol_imported: 'Protocol imported',
  diagnosis_ready: 'Diagnosis ready to review',
  intake_submitted: 'Intake submitted',
  blood_work_uploaded: 'Blood work uploaded',
  tracker_submitted: 'Tracker submitted',
  new_message: 'New client message',
  payment_received: 'Payment received',
};

async function pushToAdmin(title: string, body: string): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .eq('is_admin', true);
  if (!subs?.length) return;

  webpush.setVapidDetails('mailto:hello@thpofficial.com', publicKey, privateKey);

  const payload = JSON.stringify({
    title,
    body,
    icon: '/images/thprebrandlogo2.png',
    badge: '/images/thprebrandlogo2.png',
    url: '/admin',
  });

  const results = await Promise.allSettled(
    subs.map(row => {
      const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
      return webpush.sendNotification(sub, payload);
    })
  );

  // Drop endpoints the push service has retired, or they accumulate forever.
  const gone: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) gone.push(subs[i].endpoint);
    }
  });
  if (gone.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', gone);
  }
}

export async function notifyAdmin(
  userEmail: string,
  type: AdminAlarmType,
  message: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from('alarms').insert({
    user_email: userEmail,
    type,
    message,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('[notifyAdmin] alarm insert failed:', type, error);

  try {
    await pushToAdmin(TITLES[type] ?? 'THP', message);
  } catch (err) {
    console.error('[notifyAdmin] push failed:', type, err);
  }
}
