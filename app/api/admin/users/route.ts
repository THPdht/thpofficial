import { supabaseAdmin } from '@/lib/supabaseAdmin';

function authCheck(req: Request): boolean {
  const pw = req.headers.get('x-admin-password');
  return pw === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/users — fetch all users
export async function GET(req: Request) {
  if (!authCheck(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .order('joined_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ users: data });
}

// POST /api/admin/users — create a new client manually
export async function POST(req: Request) {
  if (!authCheck(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email, password } = await req.json();
  if (!name || !email || !password)
    return Response.json({ error: 'Missing fields.' }, { status: 400 });

  const norm = email.toLowerCase().trim();

  const { data: existing } = await supabaseAdmin
    .from('users').select('email').eq('email', norm).maybeSingle();
  if (existing)
    return Response.json({ error: 'An account with this email already exists.' }, { status: 409 });

  const { error } = await supabaseAdmin.from('users').insert({
    name: name.trim(),
    email: norm,
    password,
    status: 'new',
    streak: 0,
    longest_streak: 0,
    joined_at: new Date().toISOString().split('T')[0],
  });
  if (error) return Response.json({ error: 'Could not create account.' }, { status: 500 });

  // Also create Supabase Auth account
  await supabaseAdmin.auth.admin.createUser({ email: norm, password, email_confirm: true });

  return Response.json({ success: true });
}

// PATCH /api/admin/users — update a user's data
// Body variants:
//   { email, fields: { name?, status?, streak?, ... } }            — update top-level columns
//   { email, diagnostic_merge: { key: value, ... } }               — merge into diagnostic_data
//   { email, payment_add: { date, amount, currency, type, note? } } — add payment
//   { email, payment_remove: { paymentId: string } }               — remove payment
export async function PATCH(req: Request) {
  if (!authCheck(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { email } = body;
  if (!email) return Response.json({ error: 'Missing email.' }, { status: 400 });

  const norm = email.toLowerCase().trim();

  // Direct field update
  if (body.fields) {
    const allowed = ['name', 'nickname', 'status', 'streak', 'longest_streak', 'last_check_in', 'referral_code', 'timezone', 'diagnostic_data'];
    const dbUpdates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.fields as Record<string, unknown>)) {
      if (allowed.includes(k)) dbUpdates[k] = v;
    }
    if (Object.keys(dbUpdates).length === 0)
      return Response.json({ error: 'No valid fields to update.' }, { status: 400 });
    const { error } = await supabaseAdmin.from('users').update(dbUpdates).eq('email', norm);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // Merge into diagnostic_data
  if (body.diagnostic_merge) {
    const { data, error: fetchErr } = await supabaseAdmin
      .from('users').select('diagnostic_data').eq('email', norm).maybeSingle();
    if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });
    const diag = data?.diagnostic_data ?? {};
    const merged = { ...diag, ...body.diagnostic_merge };
    const { error } = await supabaseAdmin
      .from('users').update({ diagnostic_data: merged }).eq('email', norm);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // Add payment
  if (body.payment_add) {
    const { data, error: fetchErr } = await supabaseAdmin
      .from('users').select('diagnostic_data').eq('email', norm).maybeSingle();
    if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });
    const diag = data?.diagnostic_data ?? {};
    const payments = [...(diag.payments ?? []), { ...body.payment_add, id: Date.now().toString() }];
    const { error } = await supabaseAdmin
      .from('users').update({ diagnostic_data: { ...diag, payments } }).eq('email', norm);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // Remove payment
  if (body.payment_remove) {
    const { paymentId } = body.payment_remove;
    const { data, error: fetchErr } = await supabaseAdmin
      .from('users').select('diagnostic_data').eq('email', norm).maybeSingle();
    if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });
    const diag = data?.diagnostic_data ?? {};
    const payments = (diag.payments ?? []).filter((p: { id: string }) => p.id !== paymentId);
    const { error } = await supabaseAdmin
      .from('users').update({ diagnostic_data: { ...diag, payments } }).eq('email', norm);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: 'No valid operation specified.' }, { status: 400 });
}

// DELETE /api/admin/users — remove a client and all their data
export async function DELETE(req: Request) {
  if (!authCheck(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { email } = await req.json();
  if (!email) return Response.json({ error: 'Missing email.' }, { status: 400 });
  const norm = email.toLowerCase().trim();

  await supabaseAdmin.from('diagnostics').delete().eq('user_email', norm);
  await supabaseAdmin.from('messages').delete().eq('user_email', norm);
  await supabaseAdmin.from('push_subscriptions').delete().eq('user_email', norm);
  await supabaseAdmin.from('tracker_responses').delete().eq('user_email', norm);
  await supabaseAdmin.from('tracker_questions').delete().eq('user_email', norm);
  await supabaseAdmin.from('protocols').delete().eq('user_email', norm);
  await supabaseAdmin.from('invites').delete().eq('email', norm);
  await supabaseAdmin.from('users').delete().eq('email', norm);

  // Also remove from Supabase Auth
  const { data: authUser } = await supabaseAdmin.auth.admin.listUsers();
  const match = authUser?.users?.find(u => u.email === norm);
  if (match) await supabaseAdmin.auth.admin.deleteUser(match.id);

  return Response.json({ success: true });
}
