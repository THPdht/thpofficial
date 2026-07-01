# THP Coaching Portal — Project Context

This file is read automatically at the start of every Claude Code session in ~/thpofficial. Read it fully before doing anything.

---

## What This Is

The unified THP (The Hormone Prophet) platform at **thpofficial.com**. One Next.js 16 App Router repo containing the public marketing site (already live) plus a full coaching portal (auth, onboarding, dashboard, admin, AI protocols, daily tracker, push, messaging).

**Stack:** Next.js 16 / TypeScript / Tailwind v4 / Supabase / Anthropic claude-sonnet-4-6 / Stripe / Web Push  
**Supabase project:** `mzqguefjrsvpgycutanu.supabase.co`  
**Path alias:** `@/*` → project root (`./`)

---

## Build Status

**PASSING** — `npm run build` → 34 pages, 0 TypeScript errors. Last commit: `cc28c38` (2026-06-30).

---

## Deployment — IMPORTANT

**GitHub auto-deploy is broken.** Vercel Hobby plan blocks commits from non-owner GitHub accounts (Taz = h1azi, but Vercel owner = Ali/infoshopzul). Making repo public didn't fix it.

**Always deploy via CLI after every git push:**
```bash
npx vercel@latest --token $VERCEL_DEPLOY_TOKEN --prod --yes --scope thp-digital
```
Run from `/home/t8z1/thpofficial`. Takes ~30 seconds. Uses Ali's token → deploys as project owner.
Token is in `.env.local` as `VERCEL_DEPLOY_TOKEN` (gitignored).

---

## Admin Access

- URL: thpofficial.com/login (same page as clients)
- Email: `info.shopzul@gmail.com`
- Password: in `.env.local` as `ADMIN_PASSWORD`
- Result: redirects to /admin (Command Center)

Hardcoded in `app/admin/page.tsx` (lines 15-16) AND `app/login/page.tsx` (handleSubmit admin check).

---

## .env.local Status

File exists at `~/thpofficial/.env.local`. Gitignored. **Never commit it.**  
All vars also set in Vercel dashboard ✓ (done 2026-06-30).

### Filled in
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test), `STRIPE_SECRET_KEY` (test — live keys commented in file), `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `NEXT_PUBLIC_EMAILJS_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `INTERNAL_API_KEY`, `NEXT_PUBLIC_INTERNAL_API_KEY`, `NEXT_PUBLIC_APP_URL`, `ADMIN_PASSWORD`

### Intentionally blank
| Var | Reason |
|---|---|
| `STRIPE_WEBHOOK_SECRET` | Add after creating webhook in Stripe Dashboard |
| `NOTION_PROTOCOLS_PAGE_ID` | Optional — fill when THP provides parent page ID |

---

## Current State (as of 2026-06-30)

### Live and working
- Landing page, /apply (creates account at end), /login (unified admin+client), /onboarding, /dashboard, /admin
- 3 clients in Supabase: Vasilije Radovanovic, Jay Algoe, Elias Christensen (default password in .env.local)
- Missing: Jonah Campbell + Diego Zavala (need emails from THP)
- CSS vars fully defined in globals.css (portal design system)
- Admin: THP logo, Command Center heading, visible section dividers

### Pending — next session
1. **Skool + Stripe client import** (~100 clients) — scripts not yet written
2. **Telegram automation retrofit** — existing n8n flows in ~/Zanoto-Auto/ use Telegram; need to wire to portal instead (protocol delivery via push notification to /dashboard)
3. **Stripe data in admin** — show per-client subscription/payment status pulled from Stripe API
4. **Verify client dashboard** — test login as Vasilije/Jay/Elias, confirm dashboard loads correctly

---

## Route Map

```
PUBLIC
/                  Landing
/apply             15-step application → creates user account at end
/referral          ?ref=CODE → localStorage → /apply

AUTH  
/login             Unified: clients → /dashboard, admin → /admin
/onboarding        40-field THP intake form
/onboarding/pending

PORTAL
/dashboard         Protocol / Tracker / Book / Chat
/admin             Command Center (THP admin only)

API (routes under /api/)
generate-protocol, webhooks/stripe, chat, transcribe,
tracker-submit/response/questions/summary/generate/daily/cron,
push-subscribe/push-send, log-access, notion-protocol
```

---

## Key Files

| File | Purpose |
|---|---|
| `lib/auth.ts` | Auth + DiagnosticData type (40 intake fields) |
| `lib/supabase.ts` | Lazy anon Supabase client |
| `lib/supabaseAdmin.ts` | Lazy service-role client (server routes only) |
| `lib/protocols.ts` | PROTOCOLS map + DEFAULT_TRACKER_FIELDS |
| `lib/site.ts` | Brand strings, cal.com link, nav links |
| `app/globals.css` | Brand CSS vars + portal design system vars |
| `app/admin/page.tsx` | Full admin Command Center |
| `scripts/import-notion-clients.ts` | One-time Notion client import (already run) |

---

## Brand Rules

- THP red: `var(--color-red)` = `#c8102e` / `var(--primary)` in portal
- Background: `var(--color-ink)` = `#0a0a0a`
- Portal CSS vars defined in `:root` in globals.css (--bg, --surface, --border, --dim, --muted, --ink etc.)
- Fonts: Holtwood One SC (display), Libre Franklin (body), DM Mono (mono)
- Language: English only
- Logo image: `/images/thprebrandlogo2.png`
