import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/apiAuth';

export const maxDuration = 120;

/**
 * Weekly call-prep brief.
 *
 * THP hits this before a 1-on-1: it returns the client's last 7 days of tracker
 * entries plus a short AI brief telling him what to actually ask about on the call.
 * Briefs are cached per (client, week ending) in `weekly_briefs` and only
 * regenerated on request, or when the client has logged more days since.
 */

type TrackerDay = {
  id: string;
  date: string;
  circadian: Record<string, unknown> | null;
  training: Record<string, unknown> | null;
  nutrition: Record<string, unknown> | null;
  vitals: Record<string, unknown> | null;
  psychological: Record<string, unknown> | null;
  business: Record<string, unknown> | null;
};

type Brief = {
  headline: string;
  adherence: { logged_days: number; missed_dates: string[] };
  wins: string[];
  concerns: string[];
  patterns: string[];
  ask_on_call: string[];
};

const SYSTEM_PROMPT = `You are preparing a hormone coach for a 1-on-1 call with his client.

He has 60 seconds to read what you write before the call starts. Write for that.

Rules:
- Be specific. Every claim cites a date or a number from the tracker data. "Energy dropped to 4 on Aug 9" beats "energy was low".
- No praise, no filler, no coaching advice aimed at the client. This is a private briefing for the coach.
- If the data is thin (2-3 days logged), say so plainly rather than inventing patterns.
- "ask_on_call" is the most important field: 3-5 questions he should actually ask, each anchored to something concrete in the week. Questions that open a conversation, not yes/no checks.
- Read the free-text fields (identity_audit, obstacle, fear_exposure, dominant_emotion) as carefully as the numbers. That's where the real signal is.
- Where the week contradicts what his current protocol prescribed, call that out.

Respond with ONLY a JSON object, no markdown fences:
{
  "headline": "one sentence, the single most important thing about this week",
  "adherence": { "logged_days": number, "missed_dates": ["YYYY-MM-DD"] },
  "wins": ["..."],
  "concerns": ["..."],
  "patterns": ["..."],
  "ask_on_call": ["..."]
}
Keep each array to 2-5 short entries. Every string one sentence.`;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/** Every date in the window, so gaps in the client's logging are visible. */
function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = shiftDays(d, 1)) out.push(d);
  return out;
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email')?.toLowerCase().trim();
  const endParam = searchParams.get('end');
  const refresh = searchParams.get('refresh') === '1';
  // Stepping through weeks must never cost a model call. Only an explicit
  // "get the brief" click (gen=1) or a regenerate (refresh=1) writes a new one.
  const gen = refresh || searchParams.get('gen') === '1';

  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });
  if (endParam && !/^\d{4}-\d{2}-\d{2}$/.test(endParam)) {
    return Response.json({ error: 'Invalid end date' }, { status: 400 });
  }

  const end = endParam ?? isoDate(new Date());
  const start = shiftDays(end, -6);

  const [trackerRes, analysisRes] = await Promise.all([
    supabaseAdmin
      .from('daily_trackers')
      .select('id, date, circadian, training, nutrition, vitals, psychological, business')
      .eq('user_email', email)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true }),
    supabaseAdmin
      .from('tracker_analysis')
      .select('date, talking_points, flags')
      .eq('user_email', email)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true }),
  ]);

  if (trackerRes.error) {
    return Response.json({ error: trackerRes.error.message }, { status: 500 });
  }

  const days = (trackerRes.data ?? []) as TrackerDay[];
  const analysis = analysisRes.data ?? [];
  const allDates = datesInRange(start, end);

  if (days.length === 0) {
    return Response.json({
      start, end, days: [], allDates, analysis: [], brief: null, reason: 'no_entries',
    });
  }

  // Cached brief, unless the caller forced a refresh or the client logged more
  // days since it was written.
  let cached: { brief: unknown; day_count: number; generated_at: string } | null = null;
  if (!refresh) {
    const res = await supabaseAdmin
      .from('weekly_briefs')
      .select('brief, day_count, generated_at')
      .eq('user_email', email)
      .eq('week_end', end)
      .maybeSingle();
    cached = res.data;

    if (cached && cached.day_count >= days.length) {
      return Response.json({
        start, end, days, allDates, analysis,
        brief: cached.brief as Brief,
        cached: true,
        generatedAt: cached.generated_at,
      });
    }
  }

  // Not asked to generate: hand back the week, plus an out-of-date brief if one
  // exists so he can see something while deciding whether to refresh it.
  if (!gen) {
    return Response.json({
      start, end, days, allDates, analysis,
      brief: (cached?.brief as Brief) ?? null,
      cached: !!cached,
      stale: !!cached,
      generatedAt: cached?.generated_at ?? null,
    });
  }

  // Context the brief is judged against: the published diagnosis and whatever
  // protocol the client is actually running right now.
  const [diagRes, protoRes] = await Promise.all([
    supabaseAdmin
      .from('diagnostics')
      .select('title, content')
      .eq('user_email', email)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('protocols')
      .select('title, content, sent_at')
      .eq('user_email', email)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const missed = allDates.filter((d) => !days.some((row) => row.date === d));

  const userContext = `WEEK: ${start} to ${end}
DAYS LOGGED: ${days.length} of 7
MISSED DATES: ${missed.length ? missed.join(', ') : 'none'}

DIAGNOSIS: ${diagRes.data ? `${diagRes.data.title}\n${JSON.stringify(diagRes.data.content)}` : 'not published yet'}

CURRENT PROTOCOL: ${protoRes.data ? `${protoRes.data.title}\n${JSON.stringify(protoRes.data.content)}` : 'none sent yet'}

DAILY TRACKER ENTRIES:
${JSON.stringify(days.map(({ id: _id, ...rest }) => rest), null, 1)}

PER-DAY NOTES ALREADY GENERATED:
${analysis.length ? JSON.stringify(analysis, null, 1) : 'none'}`;

  let brief: Brief | null = null;
  let genError: string | null = null;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContext }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    brief = JSON.parse(cleaned) as Brief;

    await supabaseAdmin.from('weekly_briefs').upsert(
      { user_email: email, week_end: end, brief, day_count: days.length, generated_at: new Date().toISOString() },
      { onConflict: 'user_email,week_end' },
    );
  } catch (err) {
    // The raw week is the part he can't do without — hand it back either way.
    genError = err instanceof Error ? err.message : 'Brief generation failed';
    console.error('[weekly-brief]', genError);
  }

  return Response.json({
    start, end, days, allDates, analysis, brief, cached: false, error: genError,
  });
}
