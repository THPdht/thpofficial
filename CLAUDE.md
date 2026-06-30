# THP Coaching Portal — Project Context

This file is read automatically at the start of every Claude Code session in ~/thpofficial. Read it fully before doing anything.

---

## What This Is

The unified THP (The Hormone Prophet) platform at **thpofficial.com**. One Next.js 16 App Router repo containing the public marketing site (already live) plus a full coaching portal (auth, onboarding, dashboard, admin, AI protocols, daily tracker, push, messaging).

**Stack:** Next.js 16 / TypeScript / Tailwind v4 / Supabase / Anthropic claude-sonnet-4-6 / Stripe / Web Push  
**Hosted:** Vercel (auto-deploys from GitHub main branch)  
**Supabase project:** `mzqguefjrsvpgycutanu.supabase.co`  
**Path alias:** `@/*` → project root (`./`)

---

## Build Status

**PASSING** — `npm run build` → 34 pages, 0 TypeScript errors. Last commit: `f12614a`.

---

## .env.local Status

File exists at `~/thpofficial/.env.local`. Gitignored (`.env*` rule). **Do not commit it.**

### Filled in
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test), `STRIPE_SECRET_KEY` (test — live keys commented in file), `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `NEXT_PUBLIC_EMAILJS_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `INTERNAL_API_KEY`, `NEXT_PUBLIC_INTERNAL_API_KEY`, `NEXT_PUBLIC_APP_URL`, `ADMIN_PASSWORD`

### Intentionally blank — do not touch
| Var | Reason |
|---|---|
| `STRIPE_WEBHOOK_SECRET` | Only exists after adding webhook endpoint in Stripe Dashboard post-deploy |
| `NOTION_PROTOCOLS_PAGE_ID` | Optional — parent Notion page for protocol sub-pages; fill when THP provides it |

---

## Exact Next Steps (in order)

### 1. Run SQL schema in Supabase
Dashboard → https://mzqguefjrsvpgycutanu.supabase.co → SQL Editor → paste and run:

```sql
create table if not exists users (
  email text primary key,
  name text not null,
  password text not null,
  status text not null default 'new',
  streak int default 0,
  longest_streak int default 0,
  joined_at date default current_date,
  diagnostic_data jsonb default '{}'
);
create table if not exists presence (
  email text primary key references users(email),
  last_seen timestamptz default now()
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_email text references users(email),
  "from" text not null,
  text text not null,
  ts timestamptz default now(),
  read boolean default false,
  attachment_url text,
  attachment_type text,
  attachment_name text
);
create table if not exists protocols (
  id uuid primary key default gen_random_uuid(),
  user_email text references users(email),
  stage int default 1,
  title text,
  content jsonb,
  notion_page_id text,
  created_at timestamptz default now()
);
create table if not exists tracker_questions (
  id uuid primary key default gen_random_uuid(),
  user_email text references users(email),
  label text not null,
  hint text,
  type text not null,
  category text not null,
  weight numeric default 1,
  optional boolean default false
);
create table if not exists tracker_responses (
  id uuid primary key default gen_random_uuid(),
  user_email text references users(email),
  question_id uuid references tracker_questions(id),
  value jsonb,
  date date default current_date
);
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_email text references users(email),
  subscription jsonb not null,
  endpoint text,
  created_at timestamptz default now()
);
create table if not exists application_forms (
  id uuid primary key default gen_random_uuid(),
  full_name text, gender text, current_state_goals text[],
  other_goal text, most_important_goal text, current_weight text,
  height text, age text, body_fat_current text, body_fat_goal text,
  body_fat_duration text, symptom_severities jsonb, other_symptom text,
  symptom_duration text, bloodwork_status text, testosterone_level text,
  last_labs_date text, previous_attempts text[], supplements_used text,
  what_tried text, how_long_stuck text, why_stopped_working text,
  why_still_looking text, hours_per_week text, current_training_program text,
  medical_conditions text, stress_sleep_situation text, consequences text,
  life_solved text, how_found_us text, commitment_level int,
  investment_range text, was_referred text, referred_by text,
  email text, phone text, instagram text,
  created_at timestamptz default now()
);
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  code text,
  referred_email text,
  referrer_email text,
  created_at timestamptz default now(),
  paid_out_at timestamptz
);
create table if not exists access_logs (
  id uuid primary key default gen_random_uuid(),
  email text,
  ip text,
  user_agent text,
  reason text,
  ts timestamptz default now()
);
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table messages;
```

### 2. Test locally
```bash
npm run dev
```
Check: http://localhost:3000/apply, /register, /login, /dashboard, /admin

### 3. Deploy to Vercel
Add all filled vars from `.env.local` to Vercel → Settings → Environment Variables. Push to GitHub → auto-deploys.

### 4. Add Stripe webhook (post-deploy only)
Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://thpofficial.com/api/webhooks/stripe`
- Event: `checkout.session.completed`
- Copy `whsec_...` → add as `STRIPE_WEBHOOK_SECRET` in Vercel env vars

### 5. Client migration (future — not urgent)
Import existing clients from Skool CSV + Stripe + Notion. Script `scripts/migrate.ts` not yet written.

---

## Route Map

```
PUBLIC
/                  Landing (live)
/apply             14-step coaching application → application_forms + EmailJS
/referral          ?ref=CODE → localStorage → /apply

AUTH
/register  /login
/onboarding        40-field THP intake form (post-payment)
/onboarding/pending

PORTAL
/dashboard         Today tracker / Protocol / Book / Chat
/admin             Admin panel (ADMIN_PASSWORD protected)

API (13 routes under /api/)
generate-protocol, webhooks/stripe, chat, transcribe,
tracker-submit/response/questions/summary/generate/daily/cron,
push-subscribe/push-send, log-access, notion-protocol
```

---

## Key Files

| File | Purpose |
|---|---|
| `lib/auth.ts` | Auth + full DiagnosticData type (40 THP intake fields) |
| `lib/supabase.ts` | Lazy anon client |
| `lib/supabaseAdmin.ts` | Lazy service-role client (server routes only) |
| `lib/protocols.ts` | PROTOCOLS map + DEFAULT_TRACKER_FIELDS |
| `lib/apiAuth.ts` | requireApiKey() for internal routes |
| `app/globals.css` | Brand CSS vars |

---

## Brand Rules

- Primary: `var(--color-red)` = `#c8102e`
- Background: `var(--color-ink)` = `#0a0a0a`
- Never use `oklch()` inline — always use CSS vars or hex
- Fonts: Holtwood One SC (display), Libre Franklin (body), DM Mono (mono)
- Language: English only unless Taz explicitly asks for French
