import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Private notes live behind RLS that denies anon entirely, so the admin panel
// must reach them through the service role — same pattern as referrals and
// application-form. Writing with the anon client silently fails.
function authed(req: Request): boolean {
  const pw = req.headers.get('x-admin-password') ?? new URL(req.url).searchParams.get('pw');
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!authed(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const email = new URL(req.url).searchParams.get('email');
  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('applicant_notes')
    .select('notes, updated_at')
    .eq('user_email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ notes: data?.notes ?? '', updatedAt: data?.updated_at ?? null });
}

export async function POST(req: Request) {
  if (!authed(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { email?: string; notes?: string } | null;
  if (!body?.email || typeof body.notes !== 'string') {
    return Response.json({ error: 'Missing email or notes' }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('applicant_notes')
    .upsert(
      { user_email: body.email.toLowerCase().trim(), notes: body.notes, updated_at: updatedAt },
      { onConflict: 'user_email' },
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, updatedAt });
}
