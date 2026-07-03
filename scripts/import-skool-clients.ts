/**
 * Import Skool community members into Supabase users table.
 *
 * Usage:
 *   npx tsx scripts/import-skool-clients.ts '/path/to/community_members.csv'
 *
 * Status logic:
 *   - Has Price + "month" recurring  →  'active'  (currently paying subscriber)
 *   - Has LTV > $0 but no recurring  →  'active'  (paid before, THP knows them)
 *   - LTV = $0 / no price            →  'new'     (free community member)
 *
 * All active imports get password: '' — use invite flow for first login.
 * New members get password: '' too but need onboarding before they see a dashboard.
 *
 * Safe to re-run — skips existing emails.
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('❌  Missing Supabase env vars'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const csvPath = process.argv[2];
if (!csvPath) { console.error('❌  Pass CSV path as argument'); process.exit(1); }

// ── Minimal CSV parser (handles quoted fields with commas) ───────────────────
function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const headers = parseRow(lines[0]);
  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseRow(line);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => { record[h] = values[idx] ?? ''; });
    records.push(record);
  }
  return records;
}

function parseRow(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field.trim());
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field.trim());
  return fields;
}

// ── Parse currency strings like "$55" or "$0" → number ───────────────────────
function parseDollars(val: string): number {
  return parseFloat(val.replace(/[$,]/g, '')) || 0;
}

async function main() {
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(raw);
  console.log(`\n📋  ${rows.length} rows in CSV`);
  console.log(`📦  Supabase: ${SUPABASE_URL}\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const noEmail: string[] = [];

  for (const row of rows) {
    const firstName = (row['FirstName'] ?? '').trim();
    const lastName = (row['LastName'] ?? '').trim();
    const name = [firstName, lastName].filter(Boolean).join(' ');
    const email = (row['Email'] ?? '').toLowerCase().trim();
    const joinedRaw = (row['JoinedDate'] ?? '').trim();
    const price = parseDollars(row['Price'] ?? '');
    const recurring = (row['Recurring Interval'] ?? '').trim().toLowerCase();
    const ltv = parseDollars(row['LTV'] ?? '');
    const answer1 = (row['Answer1'] ?? '').trim();

    // Skip rows with no email or admin/placeholder rows
    if (!email || name.toLowerCase() === 'thp admin') {
      noEmail.push(name || '(no name)');
      continue;
    }

    // Determine status
    const isPaying = (price > 0 && recurring === 'month') || ltv > 0;
    const status = isPaying ? 'active' : 'new';

    // Derive joined_at from JoinedDate field
    const joinedAt = joinedRaw ? new Date(joinedRaw).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Map the Skool intake answer to diagnosticData.whatTryingToFix
    const diagnosticData = answer1
      ? { clientType: 'skool', whatTryingToFix: answer1, skoolLtv: ltv, skoolPrice: price }
      : { clientType: 'skool', skoolLtv: ltv, skoolPrice: price };

    // Check if already exists
    const { data: existing } = await supabase.from('users').select('email, status').eq('email', email).maybeSingle();
    if (existing) {
      console.log(`⏭   SKIP  ${email} (exists, status: ${existing.status})`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from('users').insert({
      name,
      email,
      password: '',
      status,
      streak: 0,
      longest_streak: 0,
      joined_at: joinedAt,
      diagnostic_data: diagnosticData,
    });

    if (error) {
      console.error(`❌  ERROR  ${email}: ${error.message}`);
      errors++;
    } else {
      console.log(`✅  ADDED  [${status.toUpperCase()}] ${name} <${email}> — LTV: $${ltv}`);
      imported++;
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`✅  Imported : ${imported}`);
  console.log(`⏭   Skipped  : ${skipped}`);
  console.log(`❌  Errors   : ${errors}`);
  if (noEmail.length) console.log(`⚠️   No email : ${noEmail.join(', ')}`);
  console.log(`─────────────────────────────\n`);
  console.log(`Clients with status=active need invite links. Use admin panel → Portal Access → Generate invite link.`);
}

main().catch(e => { console.error(e); process.exit(1); });
