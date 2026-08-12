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
  // At most five sentences, stored one per array item so the cap is structural
  // rather than a request the model can talk its way past. Rendered as one
  // paragraph — THP reads this in the seconds before the call starts.
  summary: string[];
  adherence: { logged_days: number; missed_dates: string[] };
};

const SYSTEM_PROMPT = `You are preparing a hormone coach for a 1-on-1 call with his client.

He reads this in the seconds before the call starts. Give him at most five sentences, and aim for three. This is the whole brief, not an intro to one.

The entire brief must fit in 400 characters. That is a hard budget — when you run out, stop. Covering less of the week in plain sentences beats covering all of it in dense ones.

This is the target density:
"Trained 5 days against a cap of 3. Sleep recovered from 5hrs on Aug 6 to 8hrs by Aug 12, and mood followed it up. Steps never hit 10k on a rest day. First business payout landed Aug 11 and his identity entries got noticeably stronger after it."

Rules:
- Be specific. Every claim cites a date or a number from the tracker data. "Energy dropped to 4 on Aug 9" beats "energy was low".
- Lead with the single most important thing about the week. Spend what's left on what actually changed or went wrong, not a tour of every metric.
- One idea per sentence. Never chain clauses with dashes or semicolons to fit more in — drop the detail instead.
- No praise, no filler, no preamble, no coaching advice aimed at the client. This is a private briefing for the coach.
- If the data is thin (2-3 days logged), say so plainly rather than inventing patterns.
- Read the free-text fields (identity_audit, obstacle, fear_exposure, dominant_emotion) as carefully as the numbers. That's where the real signal is.
- Where the week contradicts what his current protocol prescribed, say so.

Call the weekly_brief tool with your answer. Put each sentence in its own "summary" entry — five entries maximum.`;

const BRIEF_TOOL = {
  name: "weekly_brief",
  description: "Return the coach's brief for this client's week.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
        description: "At most five sentences, one per entry, most important first.",
      },
      adherence: {
        type: "object",
        properties: {
          logged_days: { type: "number" },
          missed_dates: { type: "array", items: { type: "string" }, description: "YYYY-MM-DD" },
        },
        required: ["logged_days", "missed_dates"],
      },
    },
    required: ["summary", "adherence"],
  },
};

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
    // Forced tool call, not "reply with JSON" — the same prompt style silently
    // broke analyze-tracker for two months when the model fenced its output.
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      tools: [BRIEF_TOOL],
      tool_choice: { type: 'tool', name: 'weekly_brief' },
      messages: [{ role: 'user', content: userContext }],
    });

    const toolUse = msg.content.find((b) => b.type === 'tool_use');
    if (!toolUse) throw new Error('Model did not return the weekly_brief tool call');

    const raw = toolUse.input as Brief;
    // maxItems is advisory to the model; the cap is enforced here.
    brief = { ...raw, summary: (raw.summary ?? []).slice(0, 5) };

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
