import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const { email, reason } = await req.json().catch(() => ({}));

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    await supabaseAdmin.from('access_logs').insert({
      email: email || 'unknown',
      ip,
      user_agent: userAgent,
      reason: reason || 'suspended_access_attempt',
      ts: new Date().toISOString(),
    });
  } catch {
    // Table may not exist yet; silently ignore so the dashboard still blocks access
  }

  return Response.json({ ok: true });
}
