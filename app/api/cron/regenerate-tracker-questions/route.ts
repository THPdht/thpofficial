import { supabase } from '@/lib/supabase';
import type { TrackerQuestion, WeeklyResponseSummary } from '@/lib/auth';

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all distinct clients who have at least one protocol
  const { data: protocolRows } = await supabase
    .from('protocols')
    .select('user_email, stage')
    .order('stage', { ascending: false });

  if (!protocolRows || protocolRows.length === 0) {
    return Response.json({ regenerated: 0, failed: 0 });
  }

  // Deduplicate: keep only highest stage per user
  const clientStages = new Map<string, number>();
  for (const row of protocolRows) {
    if (!clientStages.has(row.user_email)) {
      clientStages.set(row.user_email, row.stage);
    }
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mentorship.nikodem.coach';

  let regenerated = 0;
  let failed = 0;

  for (const [userEmail, currentStage] of clientStages) {
    try {
      // Fetch question bank (has protocol_text stored)
      const { data: bankRow } = await supabase
        .from('tracker_questions')
        .select('protocol_text, questions')
        .eq('user_email', userEmail)
        .eq('stage', currentStage)
        .maybeSingle();

      if (!bankRow?.protocol_text) {
        console.log(`[cron] no protocol_text for ${userEmail} stage ${currentStage}, skipping`);
        continue;
      }

      // Fetch last 7 days of responses
      const { data: responseRows } = await supabase
        .from('tracker_responses')
        .select('date, daily_questions, responses')
        .eq('user_email', userEmail)
        .gte('date', sevenDaysAgoStr)
        .lt('date', today)
        .order('date', { ascending: true });

      const rows = responseRows ?? [];

      // Build WeeklyResponseSummary
      const days = rows.map(row => ({
        date: row.date,
        responses: ((row.daily_questions ?? []) as TrackerQuestion[])
          .filter(q => (row.responses as Record<string, unknown>)?.[q.id] != null)
          .map(q => ({
            questionLabel: q.label,
            value: (row.responses as Record<string, string | number | boolean>)[q.id],
            category: q.category,
          })),
      }));

      // Category averages
      const catRatings: Record<string, number[]> = {};
      for (const row of rows) {
        const dq = (row.daily_questions ?? []) as TrackerQuestion[];
        const responses = (row.responses ?? {}) as Record<string, string | number | boolean>;
        for (const q of dq) {
          if (q.type === 'rating' && responses[q.id] != null) {
            (catRatings[q.category] ??= []).push(Number(responses[q.id]));
          }
        }
      }
      const categoryAverages = Object.entries(catRatings).map(([category, ratings]) => ({
        category,
        avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      }));

      // Flagged entries
      const FLAG_KEYWORDS = ['bad', 'worse', 'struggling', 'nothing', 'horrible', 'terrible', "didn't", 'failed', 'missed'];
      const flagged: WeeklyResponseSummary['flagged'] = [];
      for (const row of rows) {
        const dq = (row.daily_questions ?? []) as TrackerQuestion[];
        const responses = (row.responses ?? {}) as Record<string, string | number | boolean>;
        for (const q of dq) {
          const val = responses[q.id];
          if (val == null) continue;
          const isLow = q.type === 'rating' && Number(val) <= 3;
          const hasKeyword = typeof val === 'string' && FLAG_KEYWORDS.some(kw => val.toLowerCase().includes(kw));
          if (isLow || hasKeyword) flagged.push({ date: row.date, questionLabel: q.label, value: val });
        }
      }

      const recentResponses: WeeklyResponseSummary = { days, categoryAverages, flagged };

      // Fetch diagnosticData for intake context
      const { data: userRow } = await supabase
        .from('users')
        .select('diagnostic_data')
        .eq('email', userEmail)
        .maybeSingle();

      await fetch(`${baseUrl}/api/generate-tracker-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.INTERNAL_API_KEY ?? '' },
        body: JSON.stringify({
          clientEmail: userEmail,
          stage: currentStage,
          protocolText: bankRow.protocol_text,
          diagnosticData: userRow?.diagnostic_data ?? {},
          recentResponses,
        }),
      });

      regenerated++;
    } catch (err) {
      console.error(`[cron] failed for ${userEmail}:`, err);
      failed++;
    }
  }

  return Response.json({ regenerated, failed });
}
