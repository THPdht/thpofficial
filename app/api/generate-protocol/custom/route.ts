import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { IDENTITY, VOICE_RULES, METHODOLOGY, TONE } from '../prompt';
import { hasIntakeData } from '@/lib/protocols';

// One-off protocols. THP is on a call, the client raises something specific, THP says
// "I'll send you a protocol on that." The brief he types is the whole spec — there is
// no fixed section list here, unlike the staged INITIAL/ONGOING protocols.
const CUSTOM_PROMPT = `${IDENTITY}

You are writing a single one-off protocol on one specific subject. The subject is given to you as a brief written by Ali. Build the protocol around that brief and nothing else.

---

${VOICE_RULES}

---

${METHODOLOGY}

---

STRUCTURE

There is no fixed section list. Choose the sections this specific subject needs and name them for the subject. A protocol about sleeping badly while travelling gets travel and sleep sections. A protocol about opening a business gets sections about that business. Never pad a protocol with sections the subject does not call for, and never include a bloodwork panel, a weekly challenge, or a closing block unless the subject genuinely calls for one.

Write between three and six sections. Every section carries a specific instruction the client acts on. Explanation without an attached action does not belong here.

Where the methodology above applies to the subject, apply it. Where the subject sits outside it, stay in the same voice and give direct, concrete guidance anyway. Ali writes protocols on anything a client brings him.

If a coaching history summary is supplied below, build the protocol around that specific man. Never mention missing data, intake forms, or anything he has not given you.

---

${TONE}

---

OUTPUT FORMAT

You must output valid JSON with no markdown fences and no preamble:

{
  "title": "short protocol title, five words maximum, no client name",
  "sections": [
    { "heading": "SECTION HEADING IN UPPERCASE", "text": "full section text" }
  ],
  "todos": ["specific measurable action 1", "specific measurable action 2"]
}

Write each section as flowing paragraphs. Never use bullet points or numbered lists inside section text. Extract 5 to 12 concrete, measurable actions into todos.`;

export async function POST(req: Request) {
  try {
    if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientEmail, brief } = await req.json();
    if (!clientEmail) return Response.json({ error: 'Missing clientEmail' }, { status: 400 });
    if (!brief?.trim()) return Response.json({ error: 'Describe what the protocol is about.' }, { status: 400 });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

    const { data: client, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', clientEmail)
      .maybeSingle();
    if (error || !client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const name: string = client.name ?? clientEmail;
    const d: Record<string, unknown> = client.diagnostic_data || {};
    const coachingSummary: string | undefined = client.coaching_summary?.trim() || undefined;

    // Unlike the staged protocol, this one works with no client context at all — the
    // brief alone is enough to write "beat the flu fast" for someone THP just signed.
    let context = `PROTOCOL BRIEF FROM ALI:
${brief.trim()}

Client name: ${name}`;

    if (coachingSummary) {
      context += `

COACHING HISTORY SUMMARY:
${coachingSummary}`;
    } else if (hasIntakeData(d)) {
      context += `

WHAT THEY ARE TRYING TO FIX: ${d.whatTryingToFix ?? 'not stated'}
AGE / LOCATION: ${d.ageLocation ?? 'not stated'}
CURRENT STATE OF ENERGY: ${d.energyState ?? 'not stated'}
SLEEP QUALITY: ${d.sleepQuality ?? 'not stated'}
TRAINING FREQUENCY: ${d.trainingFrequency ?? 'not stated'}`;
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: CUSTOM_PROMPT,
      messages: [{ role: 'user', content: context }],
    });

    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
      }
    }

    const cleaned = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let parsed: { title?: string; sections?: { heading: string; text: string }[]; todos?: string[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[generate-protocol/custom] unparseable model output');
      return Response.json({ error: 'The model returned an unreadable protocol. Try again.' }, { status: 502 });
    }

    const sections = parsed.sections ?? [];
    if (sections.length === 0) return Response.json({ error: 'The model returned an empty protocol. Try again.' }, { status: 502 });
    const todos = parsed.todos ?? [];
    const title = (parsed.title?.trim() || brief.trim().slice(0, 60));

    // Sort above existing protocols without claiming a stage number — these are
    // one-offs, and the UI shows their title rather than "Protocol Stage N".
    const { data: highest } = await supabase
      .from('protocols')
      .select('stage')
      .eq('user_email', clientEmail)
      .order('stage', { ascending: false })
      .limit(1);
    const stage = ((highest?.[0]?.stage as number | undefined) ?? 0) + 1;

    const { data: protocol, error: insertError } = await supabase
      .from('protocols')
      .insert({
        user_email: clientEmail,
        stage,
        title,
        content: { sections, todos },
        status: 'draft',
        source: 'custom',
      })
      .select()
      .single();
    if (insertError) {
      console.error('[generate-protocol/custom] insert error:', insertError);
      return Response.json({ error: 'Failed to save protocol' }, { status: 500 });
    }

    await supabase.from('alarms').insert({
      user_email: clientEmail,
      type: 'protocol_ready',
      message: `${name}'s one-off protocol "${title}" is ready — review and send`,
      created_at: new Date().toISOString(),
    }).then(({ error: alarmErr }) => {
      if (alarmErr) console.error('[generate-protocol/custom] alarm insert failed:', alarmErr);
    });

    return Response.json({ protocolId: protocol.id, title, stage });
  } catch (err) {
    console.error('[generate-protocol/custom]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
