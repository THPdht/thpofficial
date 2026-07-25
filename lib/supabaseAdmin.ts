import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _admin;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_: SupabaseClient, prop: string | symbol) {
    return (getAdmin() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Point the Supabase Auth password at `password` for this email, creating the
 * auth user if it doesn't exist yet.
 *
 * Passwords live in two places: the `users` table (which /api/auth/login compares)
 * and Supabase Auth (which issues the session RLS reads). Writing only the table
 * leaves the client able to "sign in" with no Auth session, at which point every
 * RLS-guarded query returns null — and /dashboard reads that as a deleted account
 * and shows "Your access has been removed". Any route that changes a password
 * must call this.
 */
export async function syncAuthPassword(email: string, password: string): Promise<{ error: string | null }> {
  const norm = email.toLowerCase().trim();
  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return { error: listError.message };

  const existing = list?.users.find(u => u.email?.toLowerCase() === norm);
  const { error } = existing
    ? await supabaseAdmin.auth.admin.updateUserById(existing.id, { password })
    : await supabaseAdmin.auth.admin.createUser({ email: norm, password, email_confirm: true });

  return { error: error?.message ?? null };
}
