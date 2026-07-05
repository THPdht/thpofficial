import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { userEmail, date, circadian, training, nutrition, vitals, psychological, business } = await req.json();
    if (!userEmail || !date) {
      return Response.json({ error: 'Missing userEmail or date' }, { status: 400 });
    }

    // Save v2 tracker to daily_trackers
    const { error } = await supabaseAdmin
      .from('daily_trackers')
      .upsert({
        user_email: userEmail,
        date,
        circadian: circadian ?? null,
        training: training ?? null,
        nutrition: nutrition ?? null,
        vitals: vitals ?? null,
        psychological: psychological ?? null,
        business: business ?? null,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'user_email,date' });

    if (error) {
      console.error('[tracker-submit] upsert error:', error);
      return Response.json({ error: 'Failed to save tracker' }, { status: 500 });
    }

    // Update last_tracker_date + increment streak
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('streak, longest_streak, last_check_in')
      .eq('email', userEmail)
      .single();
    const lastCheckIn = userData?.last_check_in?.split('T')[0];
    const newStreak = lastCheckIn === yesterday ? (userData?.streak ?? 0) + 1 : 1;
    const longestStreak = Math.max(newStreak, userData?.longest_streak ?? 0);
    await supabaseAdmin
      .from('users')
      .update({ streak: newStreak, longest_streak: longestStreak, last_check_in: today, last_tracker_date: date })
      .eq('email', userEmail);

    // Fire-and-forget: call analyze-tracker Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    fetch(`${supabaseUrl}/functions/v1/analyze-tracker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ userEmail, date }),
    }).catch((err) => console.error('[tracker-submit] analyze-tracker invoke failed:', err));

    return Response.json({ success: true });
  } catch (err) {
    console.error('[tracker-submit]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
