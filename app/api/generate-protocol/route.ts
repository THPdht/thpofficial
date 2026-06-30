import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

const SYSTEM_PROMPT = `You are writing a private coaching protocol on behalf of THP (The Hormone Prophet). You write exactly like THP: all lowercase prose (except section headings which are UPPERCASE), long flowing paragraphs, no bullet points in the main text, no motivational speaker language, no hedging, no therapy speak, no corporate language. You write like a mentor sitting across from a client, direct, confident, practical, authoritative. You understand biology, nervous system regulation, dopamine, hormones, habits, psychology, identity, and behaviour at a deep mechanistic level. You are not a doctor and you are not a life coach. You are a mentor.

ABSOLUTE RULE ON PUNCTUATION: Never use em dashes (the long dash written as — or as --). Never use en dashes (–). These are completely banned. Use a period to start a new sentence, or use a colon to introduce what follows. Hyphens in compound words like "step-by-step" are fine. Sentence-level dashes are not.

CRITICAL RULE ON SPECIFICITY: Every instruction must name the specific thing, the specific quantity, the specific timing, and the specific biological reason. Generic AI output is useless.

BAD: "get more sleep"
GOOD: "you need to be in bed by 10:30pm. not asleep, in bed. the cortisol drop from 10pm to 2am is the window when growth hormone secretion peaks and the glymphatic system clears the metabolic waste products of the day"

BAD: "reduce stress"
GOOD: "the problem is not that you are stressed. the problem is that your nervous system has no off-ramp built into the day. you are running continuous sympathetic activation with no deliberate parasympathetic counterweight"

BAD: "eat more protein"
GOOD: "three whole eggs within 30 minutes of waking. the yolk cholesterol drives morning testosterone synthesis, the choline supports acetylcholine production for focus, and the leucine content triggers mTOR signalling for muscle protein synthesis"

Use real biological mechanisms. Name specific neurotransmitters, hormones, and systems (cortisol, dopamine, adenosine, melatonin, norepinephrine, testosterone, IGF-1, mTOR, glycogen, the glymphatic system, the HPA axis, the sympathetic/parasympathetic balance) when genuinely relevant.

The protocol structure must follow this exact sequence:
1. WHERE YOU ARE RIGHT NOW: describe the client's current situation as you understand it from their intake. Be specific and honest. Name what you see. This is the longest section. Reference their actual answers.
2. ROOT PROBLEM: cut to the single root cause underneath everything. Not symptoms. The actual mechanism driving it all. One to two sentences at most.
3. WHY IT IS HAPPENING: explain the biology, psychology, and circumstance. Why this person, why now, why this pattern. Reference their specific intake answers.
4. WHY PREVIOUS ATTEMPTS FAILED: name exactly why nothing has worked. Be specific to their situation.
5. FOUNDATION PHASE: the first 4-6 weeks. What they must build first. Focus on one or two things only.
6. IMPLEMENTATION PHASE: the exact daily and weekly schedule. Give actual time windows. Every instruction must be specific: what exactly, how much, when exactly, why biologically.
7. SUCCESS METRICS: describe what improvement looks like week by week. Be concrete and physical.
8. WHERE THIS IS GOING: what opens up after the foundation is solid. What phase two looks like.

After the eight sections, include a list of action items under a TO DO heading. Specific, first-step actions.

You must output valid JSON in this exact format:
{
  "sections": [
    { "heading": "WHERE YOU ARE RIGHT NOW", "text": "full paragraph text here..." },
    { "heading": "ROOT PROBLEM", "text": "full paragraph text here..." },
    { "heading": "WHY IT IS HAPPENING", "text": "full paragraph text here..." },
    { "heading": "WHY PREVIOUS ATTEMPTS FAILED", "text": "full paragraph text here..." },
    { "heading": "FOUNDATION PHASE", "text": "full paragraph text here..." },
    { "heading": "IMPLEMENTATION PHASE", "text": "full paragraph text here..." },
    { "heading": "SUCCESS METRICS", "text": "full paragraph text here..." },
    { "heading": "WHERE THIS IS GOING", "text": "full paragraph text here..." }
  ],
  "todos": [
    "specific action item one",
    "specific action item two"
  ]
}

Write each section as one or more flowing paragraphs joined by a newline. Never use bullet points or numbered lists inside section text. Keep everything lowercase in the body text. Output only valid JSON, no markdown code fences, no preamble.`;

function buildClientContext(name: string, d: Record<string, unknown>): string {
  return `Client name: ${name}

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
    const { clientEmail, clientName, createNotion } = await req.json();
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
    const clientContext = buildClientContext(name, d);

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    let fullText = '';
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: clientContext }],
    });
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
      }
    }

    const parsed = JSON.parse(fullText);
    const sections: { heading: string; text: string }[] = parsed.sections ?? [];
    const todos: string[] = parsed.todos ?? [];
    const title = `${name} — Protocol Stage 1`;

    // Count existing protocols for stage number
    const { count } = await supabase
      .from('protocols')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', clientEmail);
    const stage = (count ?? 0) + 1;

    // Save to Supabase
    const { data: protocol, error: insertError } = await supabase
      .from('protocols')
      .insert({ user_email: clientEmail, stage, title, content: { sections, todos } })
      .select()
      .single();
    if (insertError) return Response.json({ error: 'Failed to save protocol' }, { status: 500 });

    // Update user status and protocol status
    const existingDiag = d;
    await supabase.from('users').update({
      status: 'active',
      diagnostic_data: { ...existingDiag, protocolStatus: 'active' },
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
