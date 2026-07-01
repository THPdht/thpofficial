import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const adminPw = req.headers.get('x-admin-password');
    if (adminPw !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await req.json();
    if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

    const norm = email.toLowerCase().trim();

    // Verify user exists
    const { data: user } = await supabase.from('users').select('email').eq('email', norm).maybeSingle();
    if (!user) return Response.json({ error: 'Client not found' }, { status: 404 });

    // Invalidate any existing unused invite for this email
    await supabase.from('invites').update({ used: true }).eq('email', norm).eq('used', false);

    // Create new invite token (7 day expiry)
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('invites').insert({
      email: norm,
      token,
      expires_at: expiresAt,
      used: false,
    });

    if (error) return Response.json({ error: 'Failed to create invite' }, { status: 500 });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thpofficial.com';
    const url = `${baseUrl}/invite/${token}`;

    return Response.json({ url, token, expiresAt });
  } catch (err) {
    console.error('[invite]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
