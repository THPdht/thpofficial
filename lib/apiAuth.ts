import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Authorization for API routes.
 *
 * Every route under /api that touches client data runs with the service-role key,
 * which bypasses RLS completely. RLS therefore protects nothing on these paths —
 * authorization has to happen here. Without it any caller who knows a client's
 * email address can read that client's protocols, trackers and bloodwork.
 */

export function isAdmin(req: Request): boolean {
  const pw = req.headers.get('x-admin-password');
  return !!process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD;
}

/** Email of the signed-in Supabase Auth user, or null if the token is missing or invalid. */
export async function callerEmail(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return data.user.email.toLowerCase();
}

/**
 * Allow only admin, or the signed-in client asking about themselves.
 * Returns null when allowed, or the Response to return when not.
 */
export async function requireSelfOrAdmin(req: Request, email: string): Promise<Response | null> {
  if (isAdmin(req)) return null;

  const caller = await callerEmail(req);
  if (caller && caller === email.toLowerCase().trim()) return null;

  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

/** Admin-only routes: generating, sending, deleting. */
export function requireAdmin(req: Request): Response | null {
  if (isAdmin(req)) return null;
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function requireApiKey(req: Request): Response | null {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  if (req.headers.get('x-api-key') !== key) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
