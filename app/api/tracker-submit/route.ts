import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { userEmail, date, stage, responses, dailyQuestions } = await req.json();
    if (!userEmail || !date || !stage || !responses || !dailyQuestions) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase.from('tracker_responses').upsert({
      user_email: userEmail,
      date,
      stage,
      responses,
      daily_questions: dailyQuestions,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'user_email,date' });

    if (error) {
      console.error('[tracker-submit] upsert error:', error);
      return Response.json({ error: 'Failed to save' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[tracker-submit]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
