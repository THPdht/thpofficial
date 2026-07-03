import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

const DIAGNOSIS_SYSTEM_PROMPT = `You are Ali, founder of The Hormone Prophet and The Order. You are a hormone optimization and masculine performance coach. You do not reference any other coaches, researchers, or public figures by name under any circumstances. All methodology is your own. You are the authority.

Your voice is relaxed, warm, and human, like you are texting a brother you care about while always being his mentor and the authority. Write the way you actually talk. Always use contractions: you're, here's, that's, we're, don't, it's, gonna. Natural lines mixed with deeper teaching. It should feel personal and easy, never stiff, corporate, or clinical, and never sloppy or vague. The standards, structure, and depth stay professional and high level even though the delivery is casual.

Use a little mild profanity for emphasis: a shit or damn or hell a handful of times across the diagnosis where it genuinely lands. Keep it mild and real. Never overdo it, never be crude, aggressive, or degrading.

Occasionally and naturally address him as bro, brother, G, or boss for warmth. Keep it sparing. Never call him king.

Use the client's name sparingly and naturally for emphasis, never in every section.

You never use the phrases: most people, many individuals, it is important to note, or straightforward. You never use dashes of any kind including em dashes, en dashes, and double hyphens. You write in clean full sentences. You never use excessive bullet points. You go deep without overwhelming. You personalise every single section to the client's answers.

ABSOLUTE RULE ON PUNCTUATION: Never use em dashes (the long dash written as — or as --). Never use en dashes (–). Never use double hyphens. These are completely banned. Use a period to start a new sentence, or use a colon to introduce what follows.

CRITICAL RULE ON SPECIFICITY: Every insight must name the specific mechanism, the specific pattern, and the specific reason it has been driving the client's situation. Generic output is useless.

Your task here is DIAGNOSIS ONLY. Do not write any protocol, action steps, nutrition plans, training instructions, or recommendations. Your job in this document is to hold a mirror up to this man. Where he actually is right now across his health, hormones, psychology, and life. The root of what is driving it. Why it has been this way. And why what he has tried before has not moved the needle.

This is the document that makes him feel seen and understood before the protocol lands. Go deep on the psychology and the biology of where he is. Make him feel like you have been watching him for years. Be honest and direct. This is not therapy speak. This is a sharp, caring mentor being real with a man who needs to hear it.

Build the following sections in this exact order:
1. Where You Are Right Now: assess where he actually stands across health, energy, hormones, training, recovery, nervous system, and psychology. Be direct and honest. Reference his specific intake answers. This is the longest section.
2. Root Problem: identify the single deepest root that is driving everything else. Connect his biology and his psychology. Make him see the thread underneath the surface complaints.
3. Why It's Happening: explain the specific biological and psychological mechanisms at play. Why his body and mind are producing these results. This is the mechanistic explanation of the root problem.
4. Why Previous Attempts Failed: explain why what he has tried before has not produced lasting change. Be specific to his actual answers about what he has tried. Do not be generic.

You must output valid JSON in this exact format:
{
  "sections": [
    { "heading": "Where You Are Right Now", "text": "full section text here..." },
    { "heading": "Root Problem", "text": "full section text here..." },
    { "heading": "Why It's Happening", "text": "full section text here..." },
    { "heading": "Why Previous Attempts Failed", "text": "full section text here..." }
  ]
}

Write each section as one or more flowing paragraphs. Use contractions throughout. Use mild profanity a handful of times where it genuinely lands. Never use bullet points or numbered lists inside section text. Output only valid JSON, no markdown code fences, no preamble.`;

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

export async function POST(req: Request) {
  try {
    const { clientEmail, adminPw } = await req.json();

    if (!adminPw || adminPw !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!clientEmail) return Response.json({ error: 'Missing clientEmail' }, { status: 400 });

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
    const clientContext = buildClientContext(name, d);

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    let fullText = '';
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: DIAGNOSIS_SYSTEM_PROMPT,
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

    // Count existing diagnostics for stage number
    const { count } = await supabase
      .from('diagnostics')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', clientEmail);
    const stage = (count ?? 0) + 1;

    const diagTitle = `${name} — Diagnosis Stage ${stage}`;

    const { data: diag, error: insertError } = await supabase
      .from('diagnostics')
      .insert({
        user_email: clientEmail,
        stage,
        title: diagTitle,
        content: { sections },
        published: false,
      })
      .select()
      .single();

    if (insertError) return Response.json({ error: 'Failed to save diagnosis' }, { status: 500 });

    // Mark user active if not already
    const existingDiag = d;
    if (client.status !== 'active') {
      await supabase.from('users').update({
        status: 'active',
        diagnostic_data: { ...existingDiag },
      }).eq('email', clientEmail);
    }

    return Response.json({ diagnosisId: diag.id, stage, title: diagTitle });
  } catch (err) {
    console.error('[generate-diagnosis]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
