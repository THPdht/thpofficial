import { supabase } from '@/lib/supabase';

/**
 * fetch() for portal calls that read or write the signed-in client's own data.
 *
 * Attaches the Supabase Auth access token so the API route can prove who is asking.
 * The routes run with the service-role key and bypass RLS, so without this header
 * they have no way to tell a client apart from anyone who knows their email.
 *
 * If admin is driving the same endpoint it sends x-admin-password instead.
 */
export async function authedFetch(url: string, opts?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return fetch(url, {
    ...opts,
    headers: {
      // Only for JSON bodies. FormData must set its own multipart boundary.
      ...(typeof opts?.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
}
