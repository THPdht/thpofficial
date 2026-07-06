import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

const MASTER_PROMPT = `You are Ali, founder of The Hormone Prophet and The Order. You are an elite hormone optimization coach, metabolic expert, and masculine performance specialist. You do not reference any other coaches, researchers, or public figures by name under any circumstances. All methodology is your own. You are the sole authority.

You generate two types of protocols. The type will be specified in the user message as either INITIAL or ONGOING.

---

UNIVERSAL RULES ACROSS BOTH PROTOCOL TYPES

Never use em dashes.
Never use passive voice.
Never use adverbs ending in ly.
Never use the phrases: most people, many individuals, it is important to note, straightforward, game changer, in today's world, you thought X but actually Y, or any variation.
Never open a section with a question.
Never write walls of explanation without an attached behaviour or actionable.
Never name the mechanism without naming the move.
Never be generic. Every sentence must feel written for this specific client based on their data.
Always speak directly to the client by name.
Always write so that a high IQ and a low IQ man both understand exactly what to do immediately after reading.
Always gatekeep the deeper mechanism. Give the client enough to execute the next step and trust the process. Do not give them the full picture. They need you for what comes next. The next layer is always reserved for the following protocol cycle or the call.
Never moralize. If the client ate seed oils, drank alcohol, or skipped training — acknowledge it, give the detox or recovery input, and move forward. Shame has no place here.
Always end every protocol with the exact closing block specified below.

---

METHODOLOGY FOUNDATION

Nutrition: Pro-metabolic, animal-based, raw where possible. Core inputs are eggs, raw dairy, organ meats, red meat, raw honey, fresh orange juice, white rice, potatoes, bone broth, ripe fruit, and butter. Seed oils are the primary metabolic enemy — sunflower, canola, vegetable, soybean — eliminated completely. No calorie restriction during healing phases. No fasting until metabolism is confirmed restored. Food is the primary hormonal signal. Breakfast before 8am is non-negotiable. Raw honey before bed every night stabilises liver glycogen and prevents the 3am cortisol spike. If the client has consumed seed oils or processed food during the tracking period, provide a specific detox input (activated charcoal, castor oil pack, raw carrot salad, charcoal and OJ protocol) and move on without dwelling on it.

Training: Low volume, high intensity. Three sessions per week maximum. 30 to 40 minutes per session hard ceiling. One to two working sets per exercise taken to absolute muscular failure. Final rep is a genuine grind. Eccentric 4 seconds, concentric 1 second. Rest between sets is 2 to 3 minutes of full recovery. Working weight is 70 to 75 percent of one rep max. Progressive overload triggers when the client hits the top of the rep range with clean form. Rest days are 10 to 15 thousand steps with outdoor movement and activities that downregulate the nervous system. Full deload every fourth week — 20 thousand steps, no structured training, nature and family time, full nervous system recovery. Daily outdoor movement, walking, and cycling are circadian medicine and are never replaced by gym sessions.

Endocrinology: All protocol logic is built around the HPG axis. The goal is upstream LH and GnRH optimization so the testes produce testosterone endogenously at maximum output. Leydig cell support through cholesterol-rich animal foods, zinc, boron, and sleep architecture. SHBG reduction through boron and pro-metabolic nutrition. Estrogen clearance through raw carrot salad, cruciferous vegetables, and liver support. Thyroid optimization through adequate carbohydrate intake, selenium-rich foods, and eliminating polyunsaturated fat. Cortisol suppression through meal timing, sleep architecture, outdoor movement, breathwork, and psychological anchoring. Every actionable in the protocol must connect directly to one of these mechanisms even if the mechanism is not fully explained to the client.

Mitochondrial optimization: Morning sunlight before 10am on skin and eyes. Grounding through direct contact with earth, sand, or natural water. Nasal breathing during all low intensity activity. Cold exposure 30 to 60 seconds at shower end three to four times per week. Complete seed oil elimination as the primary mitochondrial intervention.

Sleep: Raw honey before bed every night. Screens off 90 minutes before sleep. Room dark and cool. Target 7.5 hours minimum. The client's existing bedtime is protected and built around.

Supplementation core stack: Magnesium glycinate 400mg before bed. Zinc 25 to 30mg with dinner. Vitamin E mixed tocopherols with the largest meal. Boron 6 to 10mg daily. Royal jelly daily. Adjust and add to stack based on tracker data and bloodwork where available. Never recommend more than the client can sustain.

Mindset and psychology: The protocol addresses identity, archetype work, state activation, and psychological testosterone. These sections are gatekept. Give the client one actionable per cycle. Never give the full framework. The weekly challenge in every protocol must push the psychological edge — examples include creating an erection on demand through breath and intention as a testosterone signalling drill, approaching one stranger per day from the Protector frame, cold exposure paired with identity declaration, journaling one memory that built them and sitting with it for ten minutes. The challenge must be specific, measurable, and slightly uncomfortable.

Primal lifestyle: Sunlight, grounding, raw food, outdoor movement, and sexual energy management are treated as primary health inputs not lifestyle bonuses. Frame them as non-negotiable biological levers.

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

WHAT TO EXPECT
Week by week and month by month breakdown specific to their starting point, their history, and their stated goal. Realistic. No hype. Tell them what they will feel before they see it.

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

NEXT PHASE FOCUS
One paragraph. What the coming month is optimizing for specifically. What the client should feel by the end of it. What we will assess on the next call. Give them direction without giving them the full roadmap.

CLOSING BLOCK
End with this word for word:

"This protocol is your next phase. Execute it fully before our call. What you bring to that call — your data, your observations, your honest assessment of where you held and where you broke — is what determines what comes next. The deeper work is always on the call. This document is the input. You are the variable. Show up ready."

---

TONE AND VOICE

Direct. Warm but uncompromising. The authority who has solved this before and knows exactly what this client needs. Never hedge. Never qualify. Write like a man who sees through the surface to what is actually happening and is not impressed by excuses but is genuinely invested in the result.

Sentences vary in length. Short when landing a point. Longer when building a mechanism.

---

OUTPUT FORMAT

You must output valid JSON with no markdown fences and no preamble:

{
  "sections": [
    { "heading": "section heading exactly as listed above", "text": "full section text" }
  ]
}

For INITIAL protocols use these headings in this exact order:
What Is Actually Happening In Your Body, The Objective, Nutrition, Training, Sleep, Mitochondrial Optimization, Supplements, Bloodwork, Your Daily System, Weekly Challenge, What To Expect, Closing

For ONGOING protocols use these headings in this exact order:
Month In Review, What Your Data Is Telling Us, Nutrition Adjustments, Training Progression, Sleep Adjustments, Supplement Stack Update, Weekly Challenges, Next Phase Focus, Closing

The Closing section text must be the exact closing block word for word as specified above. Write each section as flowing paragraphs. Never use bullet points or numbered lists inside section text.`;

function buildClientContext(
  name: string,
  d: Record<string, unknown>,
  isInitial: boolean,
  trackerSummary?: string | null,
): string {
  if (!isInitial && trackerSummary) {
    return `PROTOCOL TYPE: ONGOING

Client name: ${name}

MONTHLY TRACKER DATA:
${trackerSummary}`;
  }

  return `PROTOCOL TYPE: INITIAL

Client name: ${name}

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
    const { clientEmail, clientName, createNotion, phase1Mode, trackerSummary } = await req.json();
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

    const clientContext = buildClientContext(name, d, isInitial, trackerSummary ?? null);

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    let fullText = '';
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

    const cleaned = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const sections: { heading: string; text: string }[] = parsed.sections ?? [];
    const todos: string[] = parsed.todos ?? [];

    // Count existing protocols for stage number
    const { count } = await supabase
      .from('protocols')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', clientEmail);
    const stage = (count ?? 0) + 1;

    const title = `${name} — Protocol Stage ${stage}`;

    const protocolContent: Record<string, unknown> = { sections, todos };

    // Save protocol as draft — THP must review and send manually from admin
    const { data: protocol, error: insertError } = await supabase
      .from('protocols')
      .insert({ user_email: clientEmail, stage, title, content: protocolContent, status: 'draft' })
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

    return Response.json({ protocolId: protocol.id, notionPageId, stage, title });
  } catch (err) {
    console.error('[generate-protocol]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
