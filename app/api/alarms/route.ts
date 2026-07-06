import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET — fetch undismissed alarms (admin only)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pw = searchParams.get('pw');
  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('alarms')
    .select('id, user_email, type, message, created_at')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ alarms: data ?? [] });
}

// POST — insert a new alarm
export async function POST(req: Request) {
  try {
    const { user_email, type, message } = await req.json();
    if (!user_email || !type || !message) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('alarms').insert({
      user_email,
      type,
      message,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[alarms] insert failed:', error);
      return Response.json({ error: 'Failed to insert alarm' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[alarms]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — dismiss an alarm by id
export async function PATCH(req: Request) {
  try {
    const { id, pw } = await req.json();
    if (!pw || pw !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    await supabaseAdmin
      .from('alarms')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id);

    return Response.json({ success: true });
  } catch (err) {
    console.error('[alarms] dismiss:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
