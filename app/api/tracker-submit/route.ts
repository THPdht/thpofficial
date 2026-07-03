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

    // Update last_tracker_date on user row
    await supabaseAdmin
      .from('users')
      .update({ last_tracker_date: date })
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
