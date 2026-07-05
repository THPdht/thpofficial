import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { requireApiKey } from '@/lib/apiAuth';

export async function POST(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;
  try {
    const { userEmail, date, stage, responses, dailyQuestions } = await req.json();
    if (!userEmail || !date || !stage || !responses || !dailyQuestions) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert response row (locked once submitted: upsert is idempotent)
    const { error } = await supabase.from('tracker_responses').upsert({
      user_email: userEmail,
      date,
      stage,
      responses,
      daily_questions: dailyQuestions,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'user_email,date' });

    if (error) {
      console.error('[tracker-response] upsert error:', error);
      return Response.json({ error: 'Failed to save response' }, { status: 500 });
    }

    // Increment streak (same logic as recordCheckIn in auth.ts but server-side)
    const { data: userRow } = await supabase
      .from('users')
      .select('streak, longest_streak, last_check_in')
      .eq('email', userEmail)
      .maybeSingle();

    if (userRow && userRow.last_check_in !== date) {
      const newStreak = (userRow.streak ?? 0) + 1;
      const newLongest = Math.max(userRow.longest_streak ?? 0, newStreak);
      await supabase.from('users').update({
        streak: newStreak,
        longest_streak: newLongest,
        last_check_in: date,
      }).eq('email', userEmail);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[tracker-response]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
