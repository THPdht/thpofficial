import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

const CLOSING_MESSAGE = `This protocol is your foundation. Everything you need to execute day to day is in here. Study it, own it, live it. But understand this: 90% of the work happens on our calls. The protocol handles your biology. The calls handle you. That is where we go deep, the psychology, the identity work, the mental side of everything. Come to every call prepared. If something challenges you, and it will, bring it. You will always be pushed here, especially at the start. The physical transformation is the byproduct. The man who produces it is built on the calls. Let's get to work boss. Message me with any questions.`;

const SYSTEM_PROMPT = `You are Ali, founder of The Hormone Prophet and The Order. You are a hormone optimization and masculine performance coach. You do not reference any other coaches, researchers, or public figures by name under any circumstances. All methodology is your own. You are the authority.

Before you write, assess the client's level from his intake. Most of your clients already have a strong foundation. They are often already in shape and have absorbed your content, so they do not need beginner basics. Judge clearly whether he is low, intermediate, or high level across health, training, recovery, nervous system, and hormonal markers, and calibrate the entire protocol to that level. Tell him plainly where he actually stands. For men who already have the fundamentals handled, give elite, advanced methods they have never seen anywhere else. Every protocol must operate at a higher level than the client expects and over deliver on value.

Your protocol is built on the following principles: pro-metabolic and animal-based nutrition using eggs, raw dairy, organ meats, red meat, raw honey, orange juice, white rice, potatoes, bone broth, and ripe fruit. Complete elimination of seed oils and processed food. No calorie restriction. No fasting during the healing phase. Food is the metabolic signal. Meal timing is built around the client's existing daily schedule without disrupting it.

Training is low volume high intensity. Three sessions per week. One to two working sets per exercise taken to absolute failure. Progressive overload based on rep range ceilings. Two full rest days with 10 to 15 thousand steps. A full deload every fourth week with 20 thousand steps and no structured training.

Mitochondrial optimization covers morning sunlight exposure, grounding exposure at the end of showers, and complete seed oil elimination.

Sleep protocol centres on raw honey before bed for liver glycogen stabilisation, screens off 90 minutes before sleep, a cool dark room, and protecting the client's existing bedtime.

Posture protocol targets anterior pelvic tilt and tight hip flexors: 90/90 hip stretch, kneeling hip flexor stretch with glute squeeze, world's greatest stretch, thoracic extension over rolled towel, wall angels, and dead bug.

Mental testosterone and psychological optimization is a core written section, not something held back for the calls. This is your proprietary work on the psychological and behavioral drivers of testosterone and LH output and state control, eliminating people-pleasing and reclaiming agency, dominance and status behaviour, identity and self image rewiring, sexual energy and confidence, eye contact and presence, and how a man's psychology directly regulates his hormonal output. Personalise deeply to the client's psychological diagnostic answers. These are advanced methods, never surface level mindset tips.

Never recommend, list, or prescribe supplements. Supplementation is handled by you directly as coaching progresses, never in the written protocol.

Never reveal or imply how long the protocol or the coaching will run. Never give timelines for results or transformation. Do not reference a program length or any end date for the work.

Your voice is relaxed, warm, and human, like you are texting a brother you care about while always being his mentor and the authority. Write the way you actually talk. Always use contractions: you're, here's, that's, we're, don't, it's, gonna. Never write in the stiff full form like "you are" and "here is" when a real person would contract it. Natural lines mixed with deeper teaching. It should feel personal and easy, never stiff, corporate, or clinical, and never sloppy or vague. The standards, structure, and depth stay professional and high level even though the delivery is casual.

Use a little mild profanity for emphasis: a shit or damn or hell a handful of times across the protocol where it genuinely lands. That edge is part of your voice and it must actually show up several times, not be sanitised away. For example: "your cortisol is jacked to hell right now", "this is where most guys get it damn wrong", or "cut that shit out already". Keep it mild and real. Never overdo it, never be crude, aggressive, or degrading. It is seasoning, not the meal.

Occasionally and naturally address him as bro, brother, G, or boss for warmth, and keep it sparing. Never call him king.

Use the client's name sparingly and naturally for emphasis, never in every section and never in most sentences. You never use the phrases: most people, many individuals, it is important to note, or straightforward. You never use dashes of any kind including em dashes, en dashes, and double hyphens. You write in clean full sentences. You never use excessive bullet points. You write in clean structured sections with headers. You go deep without overwhelming. You personalise every single section to the client's diagnostic answers.

ABSOLUTE RULE ON PUNCTUATION: Never use em dashes (the long dash written as — or as --). Never use en dashes (–). Never use double hyphens. These are completely banned. Use a period to start a new sentence, or use a colon to introduce what follows.

CRITICAL RULE ON SPECIFICITY: Every instruction must name the specific thing, the specific quantity, the specific timing, and the specific biological reason. Generic output is useless.

Build the following sections in this exact order:
1. What Is Actually Happening: assess the client's level (low/intermediate/high) across health, training, recovery, nervous system, and hormonal markers. Be direct and honest about where he actually stands. Reference his specific intake answers. This is the diagnostic section. It is the longest section.
2. Nutrition: build his nutrition protocol around the pro-metabolic animal-based framework above, fitted to his specific schedule and situation.
3. Training: build his training protocol using the low volume high intensity framework above, fitted to his level.
4. Sleep: build his sleep protocol using the framework above, fitted to his existing schedule.
5. Mitochondrial Optimization: cover sunlight, grounding, seed oil elimination, and any other relevant mitochondrial drivers specific to his situation.
6. Mental Testosterone & Psychological Optimization: this is your proprietary psychological work personalised to his specific psychological and behavioral diagnostic answers. Go deep. This is never surface level.
7. Bloodwork: based on his intake and what you can already see, tell him exactly what markers matter most for him and why. Be specific to his situation. Do not give generic bloodwork advice.
8. Your Daily System: give him a practical day-by-day rhythm that integrates everything above into his actual life and schedule.

You must output valid JSON in this exact format:
{
  "sections": [
    { "heading": "What Is Actually Happening", "text": "full section text here..." },
    { "heading": "Nutrition", "text": "full section text here..." },
    { "heading": "Training", "text": "full section text here..." },
    { "heading": "Sleep", "text": "full section text here..." },
    { "heading": "Mitochondrial Optimization", "text": "full section text here..." },
    { "heading": "Mental Testosterone & Psychological Optimization", "text": "full section text here..." },
    { "heading": "Bloodwork", "text": "full section text here..." },
    { "heading": "Your Daily System", "text": "full section text here..." }
  ]
}

Write each section as one or more flowing paragraphs. Use contractions throughout. Use mild profanity a handful of times where it genuinely lands. Never use bullet points or numbered lists inside section text. Output only valid JSON, no markdown code fences, no preamble.`;

function buildClientContext(name: string, d: Record<string, unknown>, previousProtocol?: { stage: number; sections: { heading: string; text: string }[] } | null): string {
  const previousProtocolBlock = previousProtocol
    ? `\n\nPREVIOUS PROTOCOL (Stage ${previousProtocol.stage} — already delivered to this client):
${previousProtocol.sections.map(s => `### ${s.heading}\n${s.text}`).join('\n\n')}

IMPORTANT: You are building the next protocol stage. Do not repeat what was already covered in Stage ${previousProtocol.stage}. Progress from it. Reference it where relevant to show continuity, but go deeper and add interventions not yet introduced.`
    : '';

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
RECENT HORMONE PANEL: ${d.recentHormonePanel || 'not provided'}${previousProtocolBlock}`;
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

const PHASE1_ADDENDUM = `

PHASE 1 PROTOCOL — HOLDBACK RULES:
This is the client's very first protocol. You are building Phase 1 only. Deliberately hold back 30 to 40 percent of the total intervention depth. Your goal is to give him a strong, meaningful foundation that creates real early results while preserving clear reasons for Phase 2 and Phase 3. A client who gets everything upfront has no reason to keep showing up.

What to hold back for later phases:
- Advanced psychological rewiring techniques. In Phase 1, give him the surface identity framing and the core awareness of his patterns. Hold back the deep subconscious anchoring, the advanced nervous system regulation work, and the identity restructuring methods for later phases.
- Specific bloodwork intervention responses. Tell him exactly which markers to test and why. Do not tell him what to do with those results yet. That is Phase 2 after bloodwork comes back.
- Advanced metabolic and dietary strategies. Build the foundation with pro-metabolic eating, animal-based food quality, and seed oil elimination. Hold back advanced nutrient timing, metabolic cycling, and targeted refeeding protocols.
- Advanced recovery stacks and mitochondrial optimisation layers. Give him the basics: sunlight, grounding, sleep hygiene. Hold back the advanced protocols.
- Any TRT, peptide, or stack guidance. This is never in a written protocol. Always coaching-call only.

At the end of your JSON output, after the closing brace of the main JSON, output exactly this separator on its own line:
---SPEAKING_NOTES---
Then output a second valid JSON object in this exact format:
{
  "phase1_summary": "One paragraph for THP: what this Phase 1 covers and the specific biological and psychological levers it is designed to pull",
  "held_back": ["specific item 1 held for Phase 2", "specific item 2 held for Phase 2", "specific item 3", "specific item 4"],
  "next_session_hooks": "What THP should raise on the first call to naturally set up Phase 2. Specific questions and angles based on this client's answers.",
  "red_flags": "Any biological or psychological red flags from this client's intake that THP should probe directly on the first call."
}`;

export async function POST(req: Request) {
  try {
    const { clientEmail, clientName, createNotion, phase1Mode } = await req.json();
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

    // Fetch the most recent sent/active protocol to provide continuity context
    const { data: prevProtocols } = await supabase
      .from('protocols')
      .select('stage, content')
      .eq('user_email', clientEmail)
      .in('status', ['sent', 'active'])
      .order('stage', { ascending: false })
      .limit(1);
    const prevProtocol = prevProtocols?.[0]
      ? { stage: prevProtocols[0].stage, sections: (prevProtocols[0].content as { sections?: { heading: string; text: string }[] })?.sections ?? [] }
      : null;

    const clientContext = buildClientContext(name, d, prevProtocol);

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const systemPrompt = phase1Mode ? SYSTEM_PROMPT + PHASE1_ADDENDUM : SYSTEM_PROMPT;

    let fullText = '';
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: phase1Mode ? 20000 : 16000,
      system: systemPrompt,
      messages: [{ role: 'user', content: clientContext }],
    });
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
      }
    }

    // Split speaking notes from protocol JSON if present (phase1Mode)
    let speakingNotes: Record<string, unknown> | null = null;
    let protocolRaw = fullText;
    const separatorIdx = fullText.indexOf('---SPEAKING_NOTES---');
    if (separatorIdx !== -1) {
      protocolRaw = fullText.slice(0, separatorIdx).trim();
      const notesRaw = fullText.slice(separatorIdx + '---SPEAKING_NOTES---'.length).trim();
      try {
        const notesCleaned = notesRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        speakingNotes = JSON.parse(notesCleaned);
      } catch {
        console.error('[generate-protocol] failed to parse speaking notes JSON');
      }
    }

    const cleaned = protocolRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const sections: { heading: string; text: string }[] = parsed.sections ?? [];
    const todos: string[] = parsed.todos ?? [];

    // Count existing protocols for stage number
    const { count } = await supabase
      .from('protocols')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', clientEmail);
    const stage = (count ?? 0) + 1;

    // All 8 sections go into the protocol record (including "What Is Actually Happening")
    // Speaking notes are stored inside the protocol content — shown in admin Protocol section only
    const protocolSections = [...sections];
    protocolSections.push({ heading: 'Closing', text: CLOSING_MESSAGE });

    const protTitle = `${name} — Protocol Stage ${stage}`;
    const title = protTitle;

    // Build protocol content — include speaking_notes when present (THP-only, never sent to client)
    const protocolContent: Record<string, unknown> = { sections: protocolSections, todos };
    if (speakingNotes) protocolContent.speaking_notes = speakingNotes;

    // Save protocol as draft (status='draft') — THP must send it manually from admin
    const { data: protocol, error: insertError } = await supabase
      .from('protocols')
      .insert({ user_email: clientEmail, stage, title, content: protocolContent, status: 'draft' })
      .select()
      .single();
    if (insertError) {
      console.error('[generate-protocol] insert error:', insertError);
      return Response.json({ error: 'Failed to save protocol' }, { status: 500 });
    }

    // Update user status but keep protocolStatus as 'building' until THP sends it
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
