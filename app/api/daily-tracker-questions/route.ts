import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import type { TrackerQuestion } from '@/lib/auth';
import { requireApiKey } from '@/lib/apiAuth';

const TRACKER_CATEGORIES = ['sleep', 'gut', 'hormones', 'energy', 'training', 'nervous_system', 'diet', 'mood'] as const;
const QUESTIONS_PER_DAY = 10;
const NO_REPEAT_DAYS = 3;

export async function GET(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get('userEmail');
    const date = searchParams.get('date');
    if (!userEmail || !date) return Response.json({ error: 'Missing userEmail or date' }, { status: 400 });

    // Current stage
    const { data: stageRow } = await supabase
      .from('protocols')
      .select('stage')
      .eq('user_email', userEmail)
      .order('stage', { ascending: false })
      .limit(1)
      .maybeSingle();
    const currentStage = stageRow?.stage ?? 1;

    // Question bank
    const { data: bankRow } = await supabase
      .from('tracker_questions')
      .select('questions')
      .eq('user_email', userEmail)
      .eq('stage', currentStage)
      .maybeSingle();
    const bank = (bankRow?.questions ?? []) as TrackerQuestion[];
    if (bank.length === 0) return Response.json({ questions: [], stage: currentStage });

    // Date helpers
    const offsetDate = (base: string, days: number): string => {
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    };
    const sevenDaysAgo = offsetDate(date, -7);
    const noRepeatDates = Array.from({ length: NO_REPEAT_DAYS }, (_, i) => offsetDate(date, -(i + 1)));

    // Fetch last 7 days of responses
    const { data: pastRows } = await supabase
      .from('tracker_responses')
      .select('date, daily_questions, responses')
      .eq('user_email', userEmail)
      .gte('date', sevenDaysAgo)
      .lt('date', date);
    const rows = pastRows ?? [];

    // Build recently-shown set (last NO_REPEAT_DAYS only)
    const recentlyShown = new Set<string>();
    for (const row of rows) {
      if (noRepeatDates.includes(row.date)) {
        for (const q of ((row.daily_questions ?? []) as TrackerQuestion[])) {
          recentlyShown.add(q.id);
        }
      }
    }

    // Score categories from all 7 days
    const categoryRatings: Record<string, number[]> = {};
    for (const cat of TRACKER_CATEGORIES) categoryRatings[cat] = [];
    for (const row of rows) {
      const dq = (row.daily_questions ?? []) as TrackerQuestion[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responses = (row.responses ?? {}) as Record<string, any>;
      for (const q of dq) {
        if (q.type === 'rating' && responses[q.id] != null) {
          (categoryRatings[q.category] ??= []).push(Number(responses[q.id]));
        }
      }
    }

    const categoryAvg: Record<string, number> = {};
    for (const cat of TRACKER_CATEGORIES) {
      const r = categoryRatings[cat];
      categoryAvg[cat] = r.length > 0 ? r.reduce((a, b) => a + b, 0) / r.length : 5;
    }

    // Worst-first, allocate slots (worst 2 get 2 each, rest get 1)
    const sortedCats = [...TRACKER_CATEGORIES].sort((a, b) => categoryAvg[a] - categoryAvg[b]);
    const slots: Record<string, number> = {};
    sortedCats.forEach((cat, i) => { slots[cat] = i < 2 ? 2 : 1; });

    const selected: TrackerQuestion[] = [];
    for (const cat of sortedCats) {
      const eligible = bank
        .filter(q => q.category === cat && !recentlyShown.has(q.id))
        .sort((a, b) => b.weight - a.weight);
      selected.push(...eligible.slice(0, slots[cat]));
    }

    // Fill to QUESTIONS_PER_DAY with remaining eligible questions
    if (selected.length < QUESTIONS_PER_DAY) {
      const ids = new Set(selected.map(q => q.id));
      const fill = bank.filter(q => !ids.has(q.id) && !recentlyShown.has(q.id)).sort((a, b) => b.weight - a.weight);
      selected.push(...fill.slice(0, QUESTIONS_PER_DAY - selected.length));
    }

    // Last resort: allow repeats if bank is small
    if (selected.length < QUESTIONS_PER_DAY) {
      const ids = new Set(selected.map(q => q.id));
      const repeats = bank.filter(q => !ids.has(q.id)).sort((a, b) => b.weight - a.weight);
      selected.push(...repeats.slice(0, QUESTIONS_PER_DAY - selected.length));
    }

    return Response.json({ questions: selected.slice(0, QUESTIONS_PER_DAY), stage: currentStage });
  } catch (err) {
    console.error('[daily-tracker-questions]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
