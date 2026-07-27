import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/apiAuth';

async function verifyUser(email: string, password: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('password')
    .eq('email', email)
    .maybeSingle();
  return !!data && data.password === password;
}

export async function POST(req: Request) {
  const { subscription, userEmail, password, admin } = await req.json().catch(() => ({}));
  if (!subscription) return Response.json({ error: 'subscription required' }, { status: 400 });

  // THP has no row in users, and user_email carries a foreign key to it, so an
  // admin subscription is stored with a null owner and the is_admin flag instead.
  let owner: string | null;
  if (admin) {
    if (!isAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    owner = null;
  } else {
    if (!userEmail || !password) {
      return Response.json({ error: 'subscription, userEmail and password required' }, { status: 400 });
    }
    if (!(await verifyUser(userEmail, password))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    owner = userEmail;
  }

  const endpoint = subscription.endpoint;
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({ user_email: owner, subscription, endpoint, is_admin: !!admin }, { onConflict: 'endpoint' });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint, userEmail, password, admin } = await req.json().catch(() => ({}));
  if (!endpoint) return Response.json({ error: 'endpoint required' }, { status: 400 });

  if (admin) {
    if (!isAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  } else {
    if (!userEmail || !password) {
      return Response.json({ error: 'endpoint, userEmail and password required' }, { status: 400 });
    }
    if (!(await verifyUser(userEmail, password))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return Response.json({ ok: true });
}
