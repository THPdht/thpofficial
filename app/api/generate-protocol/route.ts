import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { IDENTITY, VOICE_RULES, METHODOLOGY, TONE } from "./prompt";
import { hasIntakeData } from "@/lib/protocols";

const MASTER_PROMPT = `${IDENTITY}

You generate two types of protocols. The type will be specified in the user message as either INITIAL or ONGOING.

---

${VOICE_RULES}

---

${METHODOLOGY}
---

PROTOCOL TYPE 1 — INITIAL PROTOCOL

Triggered when the user message specifies INITIAL and provides intake form data.

This protocol is built entirely from the intake form responses and the diagnosis that was just generated. It is the client's entry point into the THP system.

Structure in this exact order:

WHAT IS ACTUALLY HAPPENING IN YOUR BODY
Based on the intake data, give a precise and direct diagnosis of what has gone wrong metabolically, hormonally, and psychologically. Name the mechanisms. Be specific to their history. No generics. This section should make the client feel seen and slightly exposed — like you read their body without them telling you everything.

THE OBJECTIVE
State the outcome in one short paragraph. Lean, energetic, hormonally optimized, psychologically sharp. Built around their specific goal from the intake. Numbers where they gave them.

NUTRITION
Build their full nutrition framework from their intake data. Map every meal to their existing daily schedule. Do not change their life — optimize it. Give exact foods, rough quantities, and timing. Include the seed oil elimination protocol. Include the honey before bed instruction. If they have a woman who cooks, acknowledge it and work around it. If they travel, build travel inputs.

TRAINING
Assign the full THP split. Upper Push Monday, Lower Wednesday, Upper Pull Friday. Give exact exercises, rep ranges, working weight percentage, rest periods, and failure instructions. Include the one rep max testing week. Include deload protocol. Include rest day movement targets. Make it impossible to misunderstand.

SLEEP
Build the sleep protocol around their existing schedule and stated sleep issues. Honey before bed. Room temperature. Screen curfew. Address any specific issues they raised in the intake.

MITOCHONDRIAL OPTIMIZATION
Sunlight, grounding, cold exposure, nasal breathing, seed oil elimination. Map each one to their specific location, lifestyle, and daily schedule from the intake.

SUPPLEMENTS
Assign the core stack. Adjust based on their intake data, any bloodwork they have, any specific deficiencies they mentioned. Give exact doses and timing. Tell them nothing else until bloodwork.

BLOODWORK
List the full panel. Total and free testosterone, LH, FSH, estradiol, SHBG, full thyroid panel, morning fasted cortisol, full metabolic panel, vitamin D. Tell them this is required by end of month one.

YOUR DAILY SYSTEM
Map every protocol element to their exact existing daily schedule from the intake. This is their operating system. It must feel built around their real life not a template. Every time block from their day should appear here with a specific input assigned to it.

WEEKLY CHALLENGE
One specific, measurable, slightly uncomfortable challenge for week one. Psychological edge, testosterone signalling, or identity-based. Advanced enough to create curiosity. Simple enough to execute immediately.

CLOSING BLOCK
End with this word for word:

"This protocol is your foundation. Everything you need for the next phase is in here — study it, own it, execute it. Ninety percent of the real work happens on our calls. The protocol handles your biology. The calls handle you. That is where we go into the psychology, the identity work, and the mental side of everything we are building. Come prepared. If something challenges you — and things will — bring it. You will always be pushed here, especially mentally. That is the point. The physical transformation is the byproduct. The man who produces it is built on the calls."

---

PROTOCOL TYPE 2 — ONGOING PROTOCOL

Triggered when the user message specifies ONGOING and provides monthly tracker data.

This protocol is built entirely from the aggregated tracker submissions for the past month. It is the client's next phase document.

Before building, analyse the tracker data across the full month and identify: compliance patterns, nutrition gaps, training performance trends, sleep quality trends, energy and libido signals, psychological state patterns, and any red flags. Build the entire protocol from this analysis.

Structure in this exact order:

MONTH IN REVIEW
A direct, honest assessment of the month based on tracker data. Name what went well specifically. Name what fell short specifically. No softening. No cheerleading. Acknowledge any seed oil exposure, alcohol, missed sessions, or sleep failures factually and give the recovery or detox input for each. Then move forward.

WHAT YOUR DATA IS TELLING US
Translate the tracker patterns into hormonal and metabolic signals. What is the sleep data saying about cortisol rhythm. What is the libido data saying about LH output. What is the energy data saying about thyroid and mitochondrial function. What is the training data saying about recovery capacity. Give the client enough of the mechanism to understand why the next phase inputs are what they are. Gatekeep the full picture. Give them the layer that makes this month make sense.

NUTRITION ADJUSTMENTS
Based on tracker data, adjust the nutrition protocol. Add, remove, or shift foods and timing based on what the data showed. If metabolism is responding, introduce the next level of pro-metabolic input. If there are compliance gaps, simplify. If there is seed oil or alcohol exposure in the data, assign the specific detox protocol for that month and move on.

TRAINING PROGRESSION
Based on training tracker data, progress or adjust the split. Add weight where rep ceilings were hit. Adjust volume if recovery was compromised. Introduce a new movement if plateau signals are present. Assign next month's deload week. Keep the 30 to 40 minute ceiling.

SLEEP ADJUSTMENTS
Based on sleep tracker data, identify the specific issue and give one targeted adjustment. Do not rebuild the whole protocol. One precise intervention based on what the data showed.

SUPPLEMENT STACK UPDATE
Based on the month's data and any bloodwork submitted, adjust the stack. Add one compound maximum per cycle. Explain the mechanism in one sentence. Give exact dose and timing.

WEEKLY CHALLENGES
Four challenges, one per week of the coming month. Each one must push slightly further than the last. Rotate between physical, psychological, testosterone signalling, and identity-based challenges. Make each challenge specific, measurable, and slightly outside the client's current comfort zone. Gatekeep the reason. Give the action not the full explanation.

CLOSING BLOCK
End with this word for word:

"This protocol is your next phase. Execute it fully before our call. What you bring to that call — your data, your observations, your honest assessment of where you held and where you broke — is what determines what comes next. The deeper work is always on the call. This document is the input. You are the variable. Show up ready."

---

${TONE}

---

OUTPUT FORMAT

You must output valid JSON with no markdown fences and no preamble:

{
  "sections": [
    { "heading": "section heading exactly as listed above", "text": "full section text" }
  ]
}

For INITIAL protocols use these headings in this exact order:
What Is Actually Happening In Your Body, The Objective, Nutrition, Training, Sleep, Mitochondrial Optimization, Supplements, Bloodwork, Your Daily System, Weekly Challenge, Closing

For ONGOING protocols use these headings in this exact order:
Month In Review, What Your Data Is Telling Us, Nutrition Adjustments, Training Progression, Sleep Adjustments, Supplement Stack Update, Weekly Challenges, Closing

The Closing section text must be the exact closing block word for word as specified above. Write each section as flowing paragraphs. Never use bullet points or numbered lists inside section text.`;

function summaryBlock(coachingSummary?: string | null): string {
  if (!coachingSummary?.trim()) return '';
  return `

COACHING HISTORY SUMMARY:
This is the record of everything known about this client from prior coaching. Build the protocol from it. Treat it as the client's intake.

${coachingSummary.trim()}`;
}

function buildClientContext(
  name: string,
  d: Record<string, unknown>,
  isInitial: boolean,
  trackerSummary?: string | null,
  coachingSummary?: string | null,
): string {
  if (!isInitial && trackerSummary) {
    return `PROTOCOL TYPE: ONGOING

Client name: ${name}
${summaryBlock(coachingSummary)}

MONTHLY TRACKER DATA:
${trackerSummary}`;
  }

  // Without this the ~35 lines below all render "not provided", and the model —
  // told to never be generic and to build everything from the client's data —
  // correctly writes a protocol saying it has nothing to work with.
  if (!hasIntakeData(d)) {
    return `PROTOCOL TYPE: INITIAL

Client name: ${name}
${summaryBlock(coachingSummary)}

This client has no intake form on file. Build the entire protocol from the coaching history summary above. Never mention the intake form, missing data, or anything the client has not provided. Where a detail is genuinely unknown, make the instruction general enough to be correct and move on.`;
  }

  return `PROTOCOL TYPE: INITIAL

Client name: ${name}
${summaryBlock(coachingSummary)}

FULL NAME: ${d.fullName || name}
AGE / LOCATION: ${d.ageLocation || 'not provided'}
CONTACT INFO: ${d.contactInfo || 'not provided'}
LOCATION AND TRAVEL PATTERN: ${d.travelPattern || 'not provided'}
WHAT THEY ARE TRYING TO FIX: ${d.whatTryingToFix || 'not provided'}
HOW THEY ASK FOR WHAT THEY WANT: ${d.howAskForWhatYouWant || 'not provided'}
PEOPLE PLEASING PATTERN: ${d.avoidDisappointing || 'not provided'}
VALIDATION SOURCE: ${d.validationSource || 'not provided'}
CURRENT STATE OF ENERGY: ${d.energyState || 'not provided'}
HOW THEY SEE THEMSELVES: ${d.selfPerception || 'not provided'}
CONFLICT AVOIDANCE: ${d.avoidConflict || 'not provided'}
RESPONSE TO CRITICISM: ${d.responseToCriticism || 'not provided'}
INTERNAL STATE ENTERING A ROOM: ${d.internalStateEnteringRoom || 'not provided'}
PAST RELATIONSHIP PATTERNS: ${d.pastRelationshipPatterns || 'not provided'}
TRAINING RECOVERY: ${d.trainingRecovery || 'not provided'}
HEIGHT / WEIGHT / BF%: ${d.heightWeightBf || 'not provided'}
AVERAGE SLEEP DURATION: ${d.sleepDuration || 'not provided'}
RELATIONSHIP STATUS / FAMILY: ${d.relationshipStatus || 'not provided'}
RELATIONSHIP TO RISK: ${d.relationshipToRisk || 'not provided'}
SEXUAL CONFIDENCE: ${d.sexualConfidence || 'not provided'}
ALCOHOL USE: ${d.alcoholUse || 'not provided'}
CURRENT MEDICATIONS: ${d.currentMedications || 'not provided'}
RELATIONSHIP TO FOOD: ${d.relationshipToFood || 'not provided'}
BASELINE INTERNAL STATE: ${d.baselineInternalState || 'not provided'}
ON TRT / HRT / PEPTIDES / SUPPLEMENTS: ${d.onTrt || 'not provided'}
WHAT STAYS SOLID WHEN TRAVELING: ${d.whatStaysSolidTraveling || 'not provided'}
CAFFEINE INTAKE: ${d.caffeineIntake || 'not provided'}
NICOTINE OR OTHER SUBSTANCES: ${d.nicotineSubstances || 'not provided'}
SLEEP QUALITY: ${d.sleepQuality || 'not provided'}
TRAINING FREQUENCY: ${d.trainingFrequency || 'not provided'}
MORNING ERECTIONS / LIBIDO QUALITY: ${d.morningErections || 'not provided'}
EYE CONTACT: ${d.eyeContact || 'not provided'}
SEXUAL DYNAMIC IN RELATIONSHIP: ${d.sexualDynamic || 'not provided'}
HOW THEY FEEL ABOUT THEIR PHYSIQUE: ${d.physiqueFeeling || 'not provided'}
TRAINING APPROACH / CURRENT SPLIT: ${d.trainingApproach || 'not provided'}
HOW THEY DECOMPRESS: ${d.howDecompress || 'not provided'}
LIBIDO (MENTAL SEX DRIVE): ${d.libido || 'not provided'}
TRAVEL FREQUENCY: ${d.travelFrequency || 'not provided'}
WAKE UP RECOVERED: ${d.wakeUpRecovered || 'not provided'}
RECENT HORMONE PANEL: ${d.recentHormonePanel || 'not provided'}`;
}

const BEHAVIORAL_PROMPT = `You are Ali, founder of The Hormone Prophet and The Order. You are a high-performance identity, psychology, and behavioral architect. You do not reference any other coaches, researchers, or public figures by name. All methodology is your own.

You generate behavioral protocol documents for clients whose primary work is psychological, identity-based, and behavioral — not hormonal or nutritional.

UNIVERSAL RULES
Never use em dashes. Never use passive voice. Never use adverbs ending in ly.
Never open a section with a question.
Never be generic. Every sentence must feel written for this specific man based on his intake data.
Always speak directly to the client by name.
Sentences vary in length. Short when landing a point. Longer when building context.
Never moralize. Acknowledge where he is without shame and move forward with precision.

OUTPUT FORMAT
You must output valid JSON with no markdown fences and no preamble:

{
  "sections": [
    { "heading": "WHERE YOU ARE RIGHT NOW", "text": "..." },
    { "heading": "ROOT PROBLEM", "text": "..." },
    { "heading": "WHY IT IS HAPPENING", "text": "..." },
    { "heading": "WHY PREVIOUS ATTEMPTS FAILED", "text": "..." },
    { "heading": "FOUNDATION PHASE", "text": "..." },
    { "heading": "IMPLEMENTATION PHASE", "text": "..." }
  ],
  "todos": ["specific measurable action 1", "specific measurable action 2"]
}

SECTION GUIDANCE

WHERE YOU ARE RIGHT NOW
A precise, direct account of where this man is psychologically, behaviorally, and socially right now. Name the specific patterns from his intake. Make him feel seen. Do not soften it.

ROOT PROBLEM
Name the single core identity or psychological mechanism driving everything else. Not symptoms. The root. One mechanism, clearly named and explained to him.

WHY IT IS HAPPENING
Explain the mechanism underneath the root problem. The developmental origin, the wiring, the pattern that formed it. Give him enough to understand without giving him the full architecture. Gatekeep the deeper layer.

WHY PREVIOUS ATTEMPTS FAILED
Be specific to his history. Name what he tried, why it felt like it should have worked, and exactly why it did not at the level of identity and behavioral architecture.

FOUNDATION PHASE
The 3 to 5 core behavioral and identity installations he builds first. Each one is a named uppercase heading (e.g. THE FRAME INSTALLATION, THE MORNING DECLARATION, THE BODY AS SIGNAL). After each uppercase heading, write 2 to 3 tight paragraphs explaining the specific protocol for that installation. Be precise about what he does, when, and why.

IMPLEMENTATION PHASE
2 to 3 named action areas (uppercase headings) with specific weekly behavioral targets. These are the moves that express the Foundation. Each should be measurable and slightly uncomfortable.

TODOS
Extract 8 to 15 specific, measurable behavioral actions from the FOUNDATION PHASE and IMPLEMENTATION PHASE sections. These are the client's immediate action items. Concrete and executable.`;

function splitText(text: string, maxLen = 1900): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('. ', maxLen);
    if (cut === -1) cut = maxLen;
    else cut += 1;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildNotionBlocks(sections: { heading: string; text: string }[], todos: string[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];
  for (const section of sections) {
    blocks.push({
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: section.heading }, annotations: { bold: true, color: 'red' } }],
      },
    });
    for (const para of section.text.split(/\n\n+/).filter(p => p.trim())) {
      for (const chunk of splitText(para.trim())) {
        blocks.push({ type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] } });
      }
    }
    blocks.push({ type: 'divider', divider: {} });
  }
  if (todos.length > 0) {
    blocks.push({
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: 'TO DO' }, annotations: { bold: true, color: 'red' } }] },
    });
    for (const item of todos) {
      blocks.push({ type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: item } }], checked: false } });
    }
  }
  return blocks;
}

export async function POST(req: Request) {
  try {
    const { clientEmail, clientName, createNotion, phase1Mode, trackerSummary, protocolFormat: requestedFormat } = await req.json();
    if (!clientEmail) return Response.json({ error: 'Missing clientEmail' }, { status: 400 });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

    const { data: client, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', clientEmail)
      .maybeSingle();
    if (error || !client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const name: string = clientName ?? client.name ?? clientEmail;
    const d: Record<string, unknown> = client.diagnostic_data || {};
    const coachingSummary: string | null = client.coaching_summary ?? null;

    // Refuse rather than spend a generation writing a protocol about the absence of
    // data. Without this the model produces sections that read "return with the
    // completed intake form" and they get saved as a draft with an alarm raised.
    if (!hasIntakeData(d) && !coachingSummary?.trim() && !trackerSummary) {
      return Response.json({
        error: 'No intake data or coaching summary for this client. Add a coaching summary in their profile first.',
      }, { status: 400 });
    }

    // Determine protocol format: explicit request > client_type column > default hormonal
    let protocolFormat: 'hormonal' | 'behavioral' = 'hormonal';
    if (requestedFormat === 'behavioral') {
      protocolFormat = 'behavioral';
    } else if (requestedFormat === 'hormonal') {
      protocolFormat = 'hormonal';
    } else {
      // Auto-detect from client_type column
      const clientType = client.client_type as string | null;
      if (clientType === 'psychological') protocolFormat = 'behavioral';
      else protocolFormat = 'hormonal'; // hormonal, both, or unset → hormonal
    }

    // Fetch the most recent sent/active protocol to determine if this is the first
    const { data: prevProtocols } = await supabase
      .from('protocols')
      .select('stage, content')
      .eq('user_email', clientEmail)
      .in('status', ['sent', 'active'])
      .order('stage', { ascending: false })
      .limit(1);

    // Auto-detect if this is the initial protocol when not explicitly passed
    const isInitial: boolean = phase1Mode ?? (prevProtocols === null || prevProtocols.length === 0);

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    let fullText = '';

    if (protocolFormat === 'behavioral') {
      // Behavioral format — simpler prompt, no streaming needed for same speed
      const behavioralContext = !hasIntakeData(d)
        ? `Generate a behavioral protocol for this client.

Client name: ${name}
${summaryBlock(coachingSummary)}

This client has no intake form on file. Build the entire protocol from the coaching history summary above. Never mention the intake form, missing data, or anything the client has not provided.`
        : `Generate a behavioral protocol for this client.

Client name: ${name}
${summaryBlock(coachingSummary)}

FULL NAME: ${d.fullName || name}
AGE / LOCATION: ${d.ageLocation || 'not provided'}
WHAT THEY ARE TRYING TO FIX: ${d.whatTryingToFix || 'not provided'}
HOW THEY ASK FOR WHAT THEY WANT: ${d.howAskForWhatYouWant || 'not provided'}
PEOPLE PLEASING PATTERN: ${d.avoidDisappointing || 'not provided'}
VALIDATION SOURCE: ${d.validationSource || 'not provided'}
CURRENT STATE OF ENERGY: ${d.energyState || 'not provided'}
HOW THEY SEE THEMSELVES: ${d.selfPerception || 'not provided'}
CONFLICT AVOIDANCE: ${d.avoidConflict || 'not provided'}
RESPONSE TO CRITICISM: ${d.responseToCriticism || 'not provided'}
INTERNAL STATE ENTERING A ROOM: ${d.internalStateEnteringRoom || 'not provided'}
PAST RELATIONSHIP PATTERNS: ${d.pastRelationshipPatterns || 'not provided'}
RELATIONSHIP STATUS / FAMILY: ${d.relationshipStatus || 'not provided'}
RELATIONSHIP TO RISK: ${d.relationshipToRisk || 'not provided'}
SEXUAL CONFIDENCE: ${d.sexualConfidence || 'not provided'}
BASELINE INTERNAL STATE: ${d.baselineInternalState || 'not provided'}
EYE CONTACT: ${d.eyeContact || 'not provided'}
SEXUAL DYNAMIC IN RELATIONSHIP: ${d.sexualDynamic || 'not provided'}
HOW THEY DECOMPRESS: ${d.howDecompress || 'not provided'}
LIBIDO (MENTAL SEX DRIVE): ${d.libido || 'not provided'}`;

      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: BEHAVIORAL_PROMPT,
        messages: [{ role: 'user', content: behavioralContext }],
      });
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text;
        }
      }
    } else {
    const clientContext = buildClientContext(name, d, isInitial, trackerSummary ?? null, coachingSummary);

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: isInitial ? 20000 : 16000,
      system: MASTER_PROMPT,
      messages: [{ role: 'user', content: clientContext }],
    });
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
      }
    }
    } // end else (hormonal)

    const cleaned = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const sections: { heading: string; text: string }[] = parsed.sections ?? [];
    const todos: string[] = parsed.todos ?? [];

    // Count only generated protocols for stage number (imports have separate numbering)
    const { count } = await supabase
      .from('protocols')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', clientEmail)
      .eq('source', 'generated');
    const stage = (count ?? 0) + 1;

    const title = `${name} — Protocol Stage ${stage}`;

    const protocolContent: Record<string, unknown> = { sections, todos };

    // Save protocol as draft — THP must review and send manually from admin
    const { data: protocol, error: insertError } = await supabase
      .from('protocols')
      .insert({ user_email: clientEmail, stage, title, content: protocolContent, status: 'draft', source: 'generated' })
      .select()
      .single();
    if (insertError) {
      console.error('[generate-protocol] insert error:', insertError);
      return Response.json({ error: 'Failed to save protocol' }, { status: 500 });
    }

    // Insert protocol_ready alarm for admin feed
    await supabase.from('alarms').insert({
      user_email: clientEmail,
      type: 'protocol_ready',
      message: `${name}'s Phase ${stage} protocol is ready — review and send`,
      created_at: new Date().toISOString(),
    }).then(({ error: alarmErr }) => {
      if (alarmErr) console.error('[generate-protocol] alarm insert failed:', alarmErr);
    });

    // Update user status
    const existingDiag = d;
    await supabase.from('users').update({
      status: 'active',
      diagnostic_data: { ...existingDiag, protocolStatus: 'building' },
    }).eq('email', clientEmail);

    // Optional Notion creation
    let notionPageId: string | undefined;
    const notionToken = process.env.NOTION_TOKEN;
    const notionParentId = process.env.NOTION_PROTOCOLS_PAGE_ID;
    if (createNotion && notionToken && notionParentId) {
      try {
        const { Client } = await import('@notionhq/client');
        const notion = new Client({ auth: notionToken });
        const notionBlocks = buildNotionBlocks(sections, todos);
        const page = await notion.pages.create({
          parent: { page_id: notionParentId },
          properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          children: notionBlocks.slice(0, 100) as any,
        });
        notionPageId = page.id;

        if (notionBlocks.length > 100) {
          for (let i = 100; i < notionBlocks.length; i += 100) {
            await notion.blocks.children.append({
              block_id: page.id,
              children: notionBlocks.slice(i, i + 100),
            });
          }
        }

        await supabase
          .from('protocols')
          .update({ notion_page_id: notionPageId })
          .eq('id', protocol.id);
      } catch (e) {
        console.error('[generate-protocol] Notion creation failed:', e);
      }
    }

    return Response.json({ protocolId: protocol.id, notionPageId, stage, title, protocolFormat });
  } catch (err) {
    console.error('[generate-protocol]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
