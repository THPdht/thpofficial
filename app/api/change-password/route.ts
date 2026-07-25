import { supabaseAdmin, syncAuthPassword } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const { email, currentPassword, newPassword } = await req.json();
  if (!email || !currentPassword || !newPassword) return Response.json({ error: 'Missing fields' }, { status: 400 });
  if (newPassword.length < 6) return Response.json({ error: 'New password must be at least 6 characters' }, { status: 400 });

  const { data: user } = await supabaseAdmin.from('users').select('password').eq('email', email).maybeSingle();
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
  if (user.password !== currentPassword) return Response.json({ error: 'Current password incorrect' }, { status: 401 });

  const { error } = await supabaseAdmin.from('users').update({ password: newPassword }).eq('email', email);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { error: authError } = await syncAuthPassword(email, newPassword);
  if (authError) {
    console.error('[change-password] auth sync', authError);
    return Response.json({ error: 'Failed to update password' }, { status: 500 });
  }

  return Response.json({ success: true });
}
