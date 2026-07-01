/**
 * Morning AI check-in cron — fires at 9am daily.
 *
 * For each active client:
 *  1. Fetch their latest protocol stage + recent tracker data
 *  2. Generate a short personalized morning message via Claude
 *  3. Insert into messages table (from_type = 'admin') so it appears in their portal chat
 *  4. Send a push notification
 *
 * Auth: Bearer token must match CRON_SECRET env var.
 * Schedule via Vercel cron: 0 9 * * *
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import webpush from 'web-push';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const pushEnabled = !!(vapidPublic && vapidPrivate);
  if (pushEnabled) {
    webpush.setVapidDetails('mailto:hello@thpofficial.com', vapidPublic!, vapidPrivate!);
  }

  // Fetch all active clients
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('email, name, diagnostic_data')
    .eq('status', 'active');

  if (usersError || !users || users.length === 0) {
    return Response.json({ sent: 0, skipped: 0 });
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      // Skip suspended clients
      if (user.diagnostic_data?.suspended) { skipped++; continue; }

      const firstName = (user.name ?? '').split(' ')[0] || 'there';

      // Fetch their latest protocol
      const { data: protocols } = await supabaseAdmin
        .from('protocols')
        .select('stage, title, content')
        .eq('user_email', user.email)
        .order('stage', { ascending: false })
        .limit(1);

      const latestProtocol = protocols?.[0] ?? null;

      // Fetch their most recent tracker submission (last 3 days)
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentTrackers } = await supabaseAdmin
        .from('tracker_submissions')
        .select('date, responses, stage')
        .eq('user_email', user.email)
        .gte('created_at', threeDaysAgo)
        .order('date', { ascending: false })
        .limit(1);

      const lastTracker = recentTrackers?.[0] ?? null;

      // Build context for Claude
      const stageLabel = latestProtocol ? `stage ${latestProtocol.stage}` : 'early stage';
      const protocolSummary = latestProtocol
        ? (latestProtocol.content?.sections as { heading: string; text: string }[] | undefined)
            ?.slice(0, 2)
            .map((s: { heading: string; text: string }) => `${s.heading}: ${s.text.slice(0, 150)}`)
            .join('\n') ?? ''
        : '';

      const trackerContext = lastTracker
        ? `last check-in: ${lastTracker.date}. responses: ${JSON.stringify(lastTracker.responses).slice(0, 300)}`
        : 'no recent check-in logged';

      const context = `Client: ${firstName} (${user.email})
Protocol: ${stageLabel}
${protocolSummary}
Tracker data: ${trackerContext}
What they are working on: ${user.diagnostic_data?.whatTryingToFix ?? 'not specified'}`;

      const systemPrompt = `You are writing a short morning check-in message from THP (The Hormone Prophet) to a coaching client.

Voice rules:
- all lowercase
- no em dashes or en dashes
- no full stops or periods anywhere
- no filler ("great question", "absolutely", "certainly")
- no hedging
- direct, warm, mentor to client
- use "you" and "your"
- casual: "bro", "G", "boss" are fine
- 1-3 sentences max
- acknowledge where they are in the process and ask one specific question about how they are tracking today
- do not be generic. reference their actual situation if you have it

Output ONLY the message text, nothing else.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: context }],
      });

      const msgText = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      if (!msgText) { skipped++; continue; }

      // Insert into messages table
      const { error: insertError } = await supabaseAdmin.from('messages').insert({
        id: `cron_${Date.now()}_${user.email.replace(/[^a-z0-9]/gi, '_')}`,
        user_email: user.email,
        from_type: 'admin',
        text: msgText,
        ts: new Date().toISOString(),
        is_read: false,
      });

      if (insertError) {
        console.error(`[tracker-cron] failed to insert message for ${user.email}:`, insertError);
        skipped++;
        continue;
      }

      // Send push notification if client has subscriptions
      if (pushEnabled) {
        const { data: subs } = await supabaseAdmin
          .from('push_subscriptions')
          .select('subscription, endpoint')
          .eq('user_email', user.email);

        if (subs && subs.length > 0) {
          const payload = JSON.stringify({
            title: 'THP Morning Check-in',
            body: msgText.slice(0, 100),
            icon: '/images/thp-icon.png',
            url: '/dashboard',
          });

          const gone: string[] = [];
          await Promise.allSettled(
            subs.map(async (row) => {
              const sub = typeof row.subscription === 'string'
                ? JSON.parse(row.subscription)
                : row.subscription;
              try {
                await webpush.sendNotification(sub, payload);
              } catch (e: unknown) {
                const status = (e as { statusCode?: number })?.statusCode;
                if (status === 410 || status === 404) gone.push(row.endpoint);
              }
            })
          );

          if (gone.length > 0) {
            await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', gone);
          }
        }
      }

      sent++;
    } catch (err) {
      console.error(`[tracker-cron] error for ${user.email}:`, err);
      skipped++;
    }
  }

  console.log(`[tracker-cron] done — sent: ${sent}, skipped: ${skipped}`);
  return Response.json({ sent, skipped });
}
