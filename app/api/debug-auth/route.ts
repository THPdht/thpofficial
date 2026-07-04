import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  // Test 1: service role
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('users').select('email, name, status').eq('email', 'test@email.com').maybeSingle();

  // Test 2: anon key (same as browser)
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: anonData, error: anonError } = await anonClient
    .from('users').select('email, name, status').eq('email', 'test@email.com').maybeSingle();

  return Response.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKeyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 30),
    serviceRole: { found: !!adminData, error: adminError?.message ?? null },
    anonRole: { found: !!anonData, error: anonError?.message ?? null },
  });
}
