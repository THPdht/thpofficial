import Anthropic from '@anthropic-ai/sdk';

// Cleans up a rough browser SpeechRecognition transcript:
// fixes grammar, capitalisation, run-ons, and filler words.
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ transcript: '' }, { status: 500 });

  try {
    const { rawTranscript } = await req.json();
    if (!rawTranscript?.trim()) return Response.json({ transcript: '' });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: 'You clean up raw voice-to-text transcripts. Fix obvious transcription errors, run-on sentences, missing punctuation, and misheard words. Preserve the speaker\'s natural voice and meaning exactly. Return only the cleaned transcript — no preamble, no commentary, no quotes.',
      messages: [{ role: 'user', content: rawTranscript }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : rawTranscript;
    return Response.json({ transcript: text });
  } catch {
    return Response.json({ transcript: '' });
  }
}
