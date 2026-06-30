import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import type { WeeklyResponseSummary } from '@/lib/auth';
import { requireApiKey } from '@/lib/apiAuth';

const INITIAL_SYSTEM_PROMPT = `You are generating a personalised daily tracker question bank for a health mentorship client. You write on behalf of Nikodem Kosowski.

Generate 20 to 25 daily tracker questions that are hyper-specific to this client's protocol and their named problems from their intake form. These questions rotate daily so the client is never asked the same question two days in a row.

Rules:
- Distribute questions across these 8 categories: sleep, gut, hormones, energy, training, nervous_system, diet, mood
- Weight by severity: a category rated 2 or 3 out of 10 gets 4 to 5 questions with weight 8 to 10. A category rated 8 or 9 gets 1 question with weight 2 to 3. Unrated categories get 2 questions with weight 5.
- Every question answerable in under 30 seconds
- Rating questions use 1 to 10 scale and must name the specific thing: not "rate your sleep" but "how quickly did you fall asleep last night"
- Boolean questions are specific facts: "did you eat breakfast within 30 minutes of waking" not "did you eat well"
- Maximum 2 text or textarea questions in the entire bank
- Questions must reference the client's specific protocol and named problems. No generic health questions.
- No em dashes, no en dashes. Hyphens in compound words are fine.
- No motivational or coaching language. Direct and clinical.

Output a valid JSON array. No markdown fences. No preamble. No trailing text.
Each object: { "id": "snake_case_unique_id", "label": "question text", "hint": "optional sub-label or unit", "type": "rating|boolean|text|textarea", "category": "sleep|gut|hormones|energy|training|nervous_system|diet|mood", "weight": 1 }`;

const WEEKLY_SYSTEM_PROMPT = `You are generating a refreshed weekly tracker question bank for a health mentorship client. You write on behalf of Nikodem Kosowski. Prepare questions the way Nikodem would prepare before a weekly check-in call.

You have their last 7 days of tracker responses. Use what they actually answered to write questions that follow up on specific things, reference what changed or stayed the same, and dig into patterns.

Tone: direct, mentor-to-client. Not clinical detachment. Not motivational. The way someone who knows this person's situation well would ask a sharp question before a call.

BAD: "rate your sleep quality"
GOOD: "your sleep onset was under 4 three times this week. is it the same waking at 3am or is it getting to sleep that is the issue now"

BAD: "how was your gut this week"
GOOD: "gut stayed flat all week despite the protocol changes. did you actually cut the starch or just reduce it"

BAD: "did you train"
GOOD: "you trained twice last week, protocol says three times. what got in the way on the third session"

Rules:
- 20 to 25 questions total across the 8 categories: sleep, gut, hormones, energy, training, nervous_system, diet, mood
- At least 6 questions must directly reference something from the last 7 days (a low score, an inconsistency, something flagged)
- Every question answerable in under 30 seconds
- Maximum 2 text or textarea questions
- No em dashes, no en dashes
- No motivational language
- Weight: questions referencing flagged or declining areas get weight 8 to 10. Stable areas get weight 3 to 5.

Output a valid JSON array. No markdown fences. No preamble. No trailing text.
Each object: { "id": "snake_case_unique_id", "label": "question text", "hint": "optional sub-label or unit", "type": "rating|boolean|text|textarea", "category": "sleep|gut|hormones|energy|training|nervous_system|diet|mood", "weight": 1 }`;

export async function POST(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;
  try {
    const { clientEmail, stage, protocolText, diagnosticData, recentResponses } = await req.json() as {
      clientEmail: string;
      stage: number;
      protocolText: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      diagnosticData: Record<string, any>;
      recentResponses?: WeeklyResponseSummary;
    };

    if (!clientEmail || !stage || !protocolText) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

    const isWeeklyRefresh = !!recentResponses && recentResponses.days.length > 0;
    const systemPrompt = isWeeklyRefresh ? WEEKLY_SYSTEM_PROMPT : INITIAL_SYSTEM_PROMPT;

    let userMessage: string;

    if (isWeeklyRefresh) {
      const daysSummary = recentResponses.days.map(day => {
        const lines = day.responses.map(r => `  ${r.questionLabel}: ${r.value}`).join('\n');
        return `${day.date}:\n${lines || '  (no responses)'}`;
      }).join('\n\n');

      const categoryLine = recentResponses.categoryAverages
        .map(c => `${c.category}: avg ${c.avg.toFixed(1)}/10`)
        .join(', ');

      const flaggedLine = recentResponses.flagged.length > 0
        ? recentResponses.flagged.map(f => `  ${f.date}: "${f.questionLabel}" = ${f.value}`).join('\n')
        : '  none';

      userMessage = `Generate the weekly tracker question bank for this client.

PROTOCOL (stage ${stage}):
${protocolText}

LAST 7 DAYS OF RESPONSES:
${daysSummary}

CATEGORY AVERAGES THIS WEEK:
${categoryLine}

FLAGGED (low scores or concerning text):
${flaggedLine}`;
    } else {
      const d = diagnosticData || {};
      userMessage = `Generate the initial tracker question bank for this client.

PROTOCOL (stage ${stage}):
${protocolText}

CLIENT INTAKE:
Focus area: ${d.focus || 'not specified'}
Energy: ${d.energyRating != null ? `${d.energyRating}/10` : 'not rated'} | Sleep: ${d.sleepRating != null ? `${d.sleepRating}/10` : 'not rated'} | Stress: ${d.stressRating != null ? `${d.stressRating}/10` : 'not rated'}
Gut rating: ${d.gutRating != null ? `${d.gutRating}/10` : 'not rated'} | Libido: ${d.hormonesLibidoRating != null ? `${d.hormonesLibidoRating}/10` : 'not rated'}
Their situation: ${d.context || 'not provided'}
Health context: ${d.healthContext || 'not provided'}`;
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    let questions: unknown[];

    try {
      let jsonStr = rawText.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      const start = jsonStr.indexOf('[');
      const end = jsonStr.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
      questions = JSON.parse(jsonStr);
    } catch {
      console.error('[generate-tracker-questions] JSON parse failed, raw:', rawText.slice(0, 300));
      return Response.json({ error: 'Failed to parse questions JSON' }, { status: 500 });
    }

    const { error } = await supabase.from('tracker_questions').upsert({
      user_email: clientEmail,
      stage,
      questions,
      protocol_text: protocolText,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_email,stage' });

    if (error) {
      console.error('[generate-tracker-questions] Supabase upsert error:', error);
      return Response.json({ error: 'Failed to save questions' }, { status: 500 });
    }

    return Response.json({ success: true, questionCount: questions.length });
  } catch (err) {
    console.error('[generate-tracker-questions]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
