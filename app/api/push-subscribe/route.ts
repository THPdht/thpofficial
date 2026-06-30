import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function verifyUser(email: string, password: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('password')
    .eq('email', email)
    .maybeSingle();
  return !!data && data.password === password;
}

export async function POST(req: Request) {
  const { subscription, userEmail, password } = await req.json().catch(() => ({}));
  if (!subscription || !userEmail || !password) {
    return Response.json({ error: 'subscription, userEmail and password required' }, { status: 400 });
  }

  const valid = await verifyUser(userEmail, password);
  if (!valid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const endpoint = subscription.endpoint;
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({ user_email: userEmail, subscription, endpoint }, { onConflict: 'endpoint' });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint, userEmail, password } = await req.json().catch(() => ({}));
  if (!endpoint || !userEmail || !password) {
    return Response.json({ error: 'endpoint, userEmail and password required' }, { status: 400 });
  }

  const valid = await verifyUser(userEmail, password);
  if (!valid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return Response.json({ ok: true });
}
