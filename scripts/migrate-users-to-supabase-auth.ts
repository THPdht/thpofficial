/**
 * One-time script: creates Supabase Auth accounts for all existing users
 * in public.users so that RLS policies based on auth.email() work.
 *
 * Run: npx tsx scripts/migrate-users-to-supabase-auth.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Fetch all users from public.users
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('email, password, name');

  if (error || !users) {
    console.error('Failed to fetch users:', error);
    process.exit(1);
  }

  console.log(`Found ${users.length} users to migrate.`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email || !user.password) {
      console.log(`  SKIP ${user.email} — missing email or password`);
      skipped++;
      continue;
    }

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // skip email verification
    });

    if (createError) {
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        console.log(`  SKIP ${user.email} — already in Supabase Auth`);
        skipped++;
      } else {
        console.error(`  FAIL ${user.email} — ${createError.message}`);
        failed++;
      }
    } else {
      console.log(`  OK   ${user.email}`);
      created++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);
}

main();
