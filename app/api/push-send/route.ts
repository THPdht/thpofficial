import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  webpush.setVapidDetails(
    'mailto:hello@thpofficial.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { userEmail, title, body, adminPw } = await req.json().catch(() => ({}));

  if (!adminPw || adminPw !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!userEmail) return Response.json({ error: 'userEmail required' }, { status: 400 });

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .eq('user_email', userEmail);

  if (!subs || subs.length === 0) return Response.json({ sent: 0 });

  const payload = JSON.stringify({
    title: title || 'THP',
    body: body || 'You have a new message',
    icon: '/images/thp-icon.png',
    badge: '/images/thp-icon.png',
    url: '/dashboard',
  });

  const results = await Promise.allSettled(
    subs.map(row => {
      const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
      return webpush.sendNotification(sub, payload);
    })
  );

  const gone: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (r.reason as any)?.statusCode;
      if (status === 410 || status === 404) gone.push(subs[i].endpoint);
    }
  });
  if (gone.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', gone);
  }

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return Response.json({ sent });
}
