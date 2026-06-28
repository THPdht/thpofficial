// Supabase browser client — STUBBED for now.
//
// Phase 1 (landing page) does not use Supabase. This exists so later phases
// (/apply, /admin, /progress) have the client ready. Fill the env vars when the
// real Supabase project exists; until then these point at placeholders and the
// client is simply never called.
//
// Env (see .env.example):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://stub.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "stub-anon-key";

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
