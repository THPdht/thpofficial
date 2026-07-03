import { supabaseAdmin } from '@/lib/supabaseAdmin';

type ActivityEvent = 'login' | 'protocol_opened' | 'diagnosis_viewed';

const EVENT_COLUMN: Record<ActivityEvent, string> = {
  login: 'last_login',
  protocol_opened: 'last_protocol_opened',
  diagnosis_viewed: 'last_diagnosis_viewed',
};

export async function POST(req: Request) {
  try {
    const { email, event } = await req.json() as { email: string; event: ActivityEvent };
    if (!email || !event || !EVENT_COLUMN[event]) {
      return Response.json({ error: 'Missing email or valid event' }, { status: 400 });
    }

    await supabaseAdmin
      .from('users')
      .update({ [EVENT_COLUMN[event]]: new Date().toISOString() })
      .eq('email', email);

    return Response.json({ success: true });
  } catch (err) {
    console.error('[activity-log]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
