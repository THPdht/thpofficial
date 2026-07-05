import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import type { TrackerQuestion } from '@/lib/auth';
import { requireApiKey } from '@/lib/apiAuth';

const TRACKER_CATEGORIES = ['sleep', 'gut', 'hormones', 'energy', 'training', 'nervous_system', 'diet', 'mood'] as const;
const FLAG_KEYWORDS = ['bad', 'worse', 'struggling', 'nothing', 'horrible', 'terrible', "didn't", 'failed', 'missed', 'awful', 'zero'];

export async function GET(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get('userEmail');
    const days = parseInt(searchParams.get('days') ?? '28', 10);
    if (!userEmail) return Response.json({ error: 'Missing userEmail' }, { status: 400 });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const { data: rows } = await supabase
      .from('tracker_responses')
      .select('date, stage, daily_questions, responses')
      .eq('user_email', userEmail)
      .gte('date', cutoffStr)
      .order('date', { ascending: true });

    const allRows = rows ?? [];
    const totalDaysTracked = allRows.length;

    // Current stage
    const { data: stageRow } = await supabase
      .from('protocols')
      .select('stage')
      .eq('user_email', userEmail)
      .order('stage', { ascending: false })
      .limit(1)
      .maybeSingle();
    const currentStage = stageRow?.stage ?? 1;

    // Split into two halves for delta (prior 7 days vs last 7 days)
    const today = new Date().toISOString().split('T')[0];
    const sevenAgo = new Date();
    sevenAgo.setDate(sevenAgo.getDate() - 7);
    const sevenAgoStr = sevenAgo.toISOString().split('T')[0];
    const fourteenAgo = new Date();
    fourteenAgo.setDate(fourteenAgo.getDate() - 14);
    const fourteenAgoStr = fourteenAgo.toISOString().split('T')[0];

    const lastWeekRows = allRows.filter(r => r.date >= sevenAgoStr);
    const priorWeekRows = allRows.filter(r => r.date >= fourteenAgoStr && r.date < sevenAgoStr);

    function avgScoreForCategory(rowSet: typeof allRows, category: string): number | null {
      const scores: number[] = [];
      for (const row of rowSet) {
        const dq = (row.daily_questions ?? []) as TrackerQuestion[];
        const responses = (row.responses ?? {}) as Record<string, string | number | boolean>;
        for (const q of dq) {
          if (q.category === category && q.type === 'rating' && responses[q.id] != null) {
            scores.push(Number(responses[q.id]));
          }
        }
      }
      return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    }

    const trends = TRACKER_CATEGORIES.map(cat => {
      const last = avgScoreForCategory(lastWeekRows, cat);
      const prior = avgScoreForCategory(priorWeekRows, cat);
      const avgScore = avgScoreForCategory(allRows, cat) ?? 5;
      const delta = last != null && prior != null ? last - prior : 0;
      const direction = delta > 0.5 ? 'improving' : delta < -0.5 ? 'declining' : 'stable';
      return { category: cat, avgScore: Math.round(avgScore * 10) / 10, direction, delta: Math.round(delta * 10) / 10 };
    });

    // Flagged entries: rating <= 3 or text containing flag keywords
    const flagged: { date: string; questionLabel: string; value: string | number | boolean; category: string }[] = [];
    for (const row of allRows) {
      const dq = (row.daily_questions ?? []) as TrackerQuestion[];
      const responses = (row.responses ?? {}) as Record<string, string | number | boolean>;
      for (const q of dq) {
        const val = responses[q.id];
        if (val == null) continue;
        const isLowRating = q.type === 'rating' && Number(val) <= 3;
        const hasKeyword = (q.type === 'text' || q.type === 'textarea') && typeof val === 'string' &&
          FLAG_KEYWORDS.some(kw => val.toLowerCase().includes(kw));
        if (isLowRating || hasKeyword) {
          flagged.push({ date: row.date, questionLabel: q.label, value: val, category: q.category });
        }
      }
    }

    return Response.json({ trends, flagged, totalDaysTracked, currentStage });
  } catch (err) {
    console.error('[tracker-summary]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
