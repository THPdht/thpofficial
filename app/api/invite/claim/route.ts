import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return Response.json({ error: 'Missing token or password' }, { status: 400 });
    if (password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

    // Look up invite
    const { data: invite } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .maybeSingle();

    if (!invite) return Response.json({ error: 'This invite link is invalid or has already been used.' }, { status: 400 });

    if (new Date(invite.expires_at) < new Date()) {
      return Response.json({ error: 'This invite link has expired. Ask THP to send a new one.' }, { status: 400 });
    }

    // Set the password and mark invite as used
    const { error: updateError } = await supabase
      .from('users')
      .update({ password })
      .eq('email', invite.email);

    if (updateError) return Response.json({ error: 'Failed to set password' }, { status: 500 });

    await supabase.from('invites').update({ used: true }).eq('token', token);

    return Response.json({ success: true, email: invite.email });
  } catch (err) {
    console.error('[invite/claim]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
