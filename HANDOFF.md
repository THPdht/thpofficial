# THP Platform — Developer Handoff

This repo is the **thpofficial.com** website: one Next.js (App Router) app on
Vercel, backed by one Supabase project. Goal is a single platform with a public
site, a client application/intake flow, an admin control room, and a client portal.

- **Live:** https://thpofficial.com (Vercel, auto-deploys from `main`)
- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase
- **Repo:** github.com/THPdht/thpofficial

---

## What's done (Phase 1 — landing page)
- Sections: Hero (pinned bg `thprealbackgroun.png`), Transformations (+ "How Ready
  Are You" box), Features ("Your Look Inside"), Coaching ("1:1 With THP", $1500/mo),
  Cal.com booking embed, FAQ, slim one-line footer.
- Legal pages: `/privacy`, `/terms`, `/disclaimer`, `/refunds`.
- Brand favicon + OG/link-preview images. Fonts: Holtwood One SC / Libre Franklin /
  DM Mono. Colors in `app/globals.css` (ink/red/cream/gold/orange).
- `lib/site.ts` — links + brand strings + `checkoutUrl` (empty → falls back to /apply).
- `lib/content.ts` — landing copy arrays.
- `lib/supabase.ts` — Supabase browser client, **stubbed** via env vars, unused so far.

## Site map (target)
- `/` — landing (done)
- `/apply` — application form (NEXT — currently a placeholder)
- `/admin` — private control room (later)
- `/progress` — client portal (later)
- Skool stays separate; never referenced on this site.

---

## Local setup
1. Node ≥20.9, git, GitHub CLI (`gh`).
2. `gh auth login` then `gh auth setup-git`.
3. `git clone https://github.com/THPdht/thpofficial.git && cd thpofficial`
4. `npm install`
5. Set a valid git author (Vercel rejects commits whose author email isn't a real
   GitHub account):
   ```
   git config user.name "THPdht"
   git config user.email "288778658+THPdht@users.noreply.github.com"
   ```
6. Create `.env.local` (git-ignored) — see `.env.example` for names:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
7. `npm run dev` → http://localhost:3000. `npm run build` before pushing.
   Push to `main` → Vercel auto-deploys.

> Heavy images (~21MB in `public/images`) live in the repo, so pushes may take a
> minute.

---

## NEXT PHASE — rebuild the `/apply` application form
Replicate the **live thpapplication.com** form into our `/apply` route, save to
Supabase, and email — reusing the SAME backend the live form already uses.

- **14-step** multi-step form. Submit button: **"See If I'm A Fit"**.
- **Supabase table:** `application_forms` (snake_case columns).
- **Email:** EmailJS — service `service_y2wv9j9`, template `template_56py1rg`,
  public key `lQYYoGLpJySvA3cMn` (public key is safe in client code).

### Fields (36) — camelCase state → snake_case DB/email param
`fullName, gender, currentStateGoals[], otherGoal, mostImportantGoal,
currentWeight, height, age, bodyFatCurrent, bodyFatGoal, bodyFatDuration,
symptomSeverities[] (each {symptom, severity 1-5}), otherSymptom, symptomDuration,
bloodworkStatus, testosteroneLevel, lastLabsDate, previousAttempts[],
supplementsUsed, whatTried, howLongStuck, whyStoppedWorking, whyStillLooking,
hoursPerWeek, currentTrainingProgram, medicalConditions, stressSleepSituation,
consequences, lifeSolved, howFoundUs, commitmentLevel (1-10), investmentRange,
wasReferred, referredBy, email, phone, instagram`

### Key questions / options
- "What's your single most important goal right now, and why does it matter to you
  personally?"
- "Where do you want to get to?" · "Required — what body fat % are you aiming for?"
  · "How long have you been at your current body fat?"
- "Select symptoms and rate their severity (1 = mild, 5 = debilitating)" · "How long
  have you been experiencing these symptoms?"
- "Have you had blood work done recently?" → Yes labs available / No but willing /
  No not interested. Then testosterone level (optional), last labs date.
- "What have you tried, how long did you stick to it, and why did it stop working?"
- "Why are you still looking for help?" · "Were you referred?"
- **Goal options:** Lose body fat / get leaner; Build muscle and strength/tone;
  Increase energy and mental clarity; Balance hormones; Fix libido/sexual
  health/performance; Regulate menstrual cycle; + Other.
- **Symptom options:** Stubborn fat, Soft physique, Weak/low libido, Low confidence,
  Thyroid issues, Irregular periods, PMS/mood swings, + Other.
- **Previous attempts:** Diet protocols, Training programs, Supplements (→ which?),
  Birth control/HRT, Other coaches, Nothing yet.
- **Investment range:** includes "$1500+ (psychological mentorship, 1 space left)".

### Build approach
- Reuse brand primitives in `components/ui/` and fonts in `app/layout.tsx`.
- Add `@emailjs/browser` (or EmailJS REST) + use `lib/supabase.ts` anon client.
- Build `app/apply/page.tsx` as the 14-step client form → insert into
  `application_forms` → EmailJS send. Match labels/options word-for-word.
- Confirm the exact `application_forms` columns in the Supabase project before
  inserting (or create the table to match the field map).
- Full intake (Notion form) is read generically by the existing intake-bot
  (`intake-bot/src/notion.js`); migrate that into Supabase in a later phase.

---

## Roadmap after /apply
1. **Stripe checkout** on the coaching button ($1500/mo) — Payment Link first, then
   embedded on-site checkout (needs Stripe keys + webhook).
2. **/admin** control room — clients table, trigger protocol builds, check-ins,
   billing ops. Replaces the Telegram bots.
3. **/progress** client portal — login (Supabase Auth), view protocol + check-ins.
4. Migrate Notion intake + retire the Telegram bots / Hostinger VPS.

---

## Credentials needed (request from owner — NEVER commit real values)
Secrets go in `.env.local` (web) or Vercel env vars. `.env.example` lists names only.
Prefer being **invited to each dashboard** over pasting raw keys (revocable access).

| Service | Needed | Unlocks |
|---|---|---|
| Supabase | Project URL, anon key, service_role key, DB password; org invite | /apply, /admin, /progress |
| Vercel | team/project member invite (`thp-digital`) | deploy, env vars, domains |
| GitHub | collaborator on `THPdht/thpofficial` | code |
| Stripe | sk_live + sk_test, pk_live, webhook secret; or account invite | checkout, billing |
| EmailJS | account login (service `service_y2wv9j9`, template `template_56py1rg`, key `lQYYoGLpJySvA3cMn`) | /apply emails |
| Notion | integration secret + Client Intake DB id (share DB w/ integration) | intake migration |
| Telegram | intake-bot: BOT_TOKEN, CHAT_ID · checkin-bot: BOT_TOKEN, STRIPE_SECRET_KEY, ADMIN_GROUP_CHAT_ID, CHECKIN_HOUR | existing bots |
| Anthropic | ANTHROPIC_API_KEY | protocol generation |
| Gmail | CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN (user info.shopzul@gmail.com) | draft delivery |
| Hostinger VPS | SSH/deploy key, IP, pm2 process names | where bots run |
| GoDaddy | login or DNS delegate (A @ → 216.198.79.1, www → vercel-dns) | domain/DNS |
