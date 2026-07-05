import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const stage = searchParams.get('stage');
  if (!email || !stage) return Response.json({ error: 'Missing params' }, { status: 400 });
  const { data } = await supabaseAdmin
    .from('tracker_questions')
    .select('protocol_text, questions')
    .eq('user_email', email)
    .eq('stage', Number(stage))
    .maybeSingle();
  return Response.json({ bank: data ?? null });
}
