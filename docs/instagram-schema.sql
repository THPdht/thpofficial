-- Instagram / ManyChat lead capture
--
-- Run once in the Supabase SQL editor (project mzqguefjrsvpgycutanu).
-- Safe to re-run: every statement is idempotent.
--
-- RLS is enabled with no policies on purpose. These tables are only ever touched
-- by /api routes using the service-role key, which bypasses RLS. Enabling it with
-- zero policies means the anon key can read nothing, which is what we want since
-- this holds lead email addresses.

-- Campaigns: one row per Instagram post/reel. The keyword changes per post, the
-- flow behind it does not. Editable from /admin so a new post needs no deploy.
create table if not exists public.ig_campaigns (
  id            uuid primary key default gen_random_uuid(),
  keyword       text not null,
  post_url      text,
  resource_url  text not null,
  dm_copy       text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Keywords are matched case-insensitively, so uniqueness has to be too.
create unique index if not exists ig_campaigns_keyword_key
  on public.ig_campaigns (upper(keyword));

-- One row per ManyChat subscriber.
create table if not exists public.ig_contacts (
  subscriber_id   text primary key,
  ig_username     text,
  first_name      text,
  email           text,
  keyword         text,
  stage           text not null default 'new',
  bot_paused      boolean not null default false,
  turns_today     integer not null default 0,
  turns_date      date,
  holding_sent_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ig_contacts_username_idx on public.ig_contacts (lower(ig_username));
create index if not exists ig_contacts_email_idx    on public.ig_contacts (lower(email));
create index if not exists ig_contacts_stage_idx    on public.ig_contacts (stage);

-- Full transcript. Doubles as the admin inbox and as per-post attribution.
create table if not exists public.ig_conversations (
  id            bigint generated always as identity primary key,
  subscriber_id text not null references public.ig_contacts (subscriber_id) on delete cascade,
  role          text not null check (role in ('user', 'bot')),
  content       text not null,
  intent        text,
  keyword       text,
  created_at    timestamptz not null default now()
);

create index if not exists ig_conversations_thread_idx
  on public.ig_conversations (subscriber_id, created_at desc);

-- Single-row kill switch for the whole bot.
create table if not exists public.ig_settings (
  id          integer primary key default 1 check (id = 1),
  bot_enabled boolean not null default true,
  updated_at  timestamptz not null default now()
);

insert into public.ig_settings (id) values (1) on conflict (id) do nothing;

alter table public.ig_campaigns     enable row level security;
alter table public.ig_contacts      enable row level security;
alter table public.ig_conversations enable row level security;
alter table public.ig_settings      enable row level security;

-- ---------------------------------------------------------------------------
-- 2026-08-02: every outgoing line becomes editable from /admin.
--
-- The bot's words used to live in the route file, so changing Ali's own phrasing
-- needed a deploy. They live here now. Per-keyword openers still win: a campaign's
-- dm_copy overrides opener_copy, which is only the fallback for a keyword that has
-- no row of its own.
-- ---------------------------------------------------------------------------

alter table public.ig_settings add column if not exists opener_copy     text;
alter table public.ig_settings add column if not exists apply_copy      text;
alter table public.ig_settings add column if not exists not_a_fit_copy  text;
alter table public.ig_settings add column if not exists holding_copy    text;

-- ---------------------------------------------------------------------------
-- 2026-08-03: test mode.
--
-- Three separate incidents reached real followers before anyone noticed. With
-- test_mode on, the bot answers only the handles listed in test_usernames and
-- stays completely silent to everyone else, so the whole flow can be exercised
-- against our own accounts first. It defaults to ON: the safe state is the
-- one you get by forgetting.
-- ---------------------------------------------------------------------------

alter table public.ig_settings add column if not exists test_mode      boolean not null default true;
alter table public.ig_settings add column if not exists test_usernames text;

-- ---------------------------------------------------------------------------
-- 2026-08-05: the qualifier log.
--
-- ManyChat now owns the conversation and calls /api/manychat/qualify at exactly
-- one fork: a working person from a high-income country goes to Ali's Telegram
-- for a call, everyone else goes to the course. That endpoint holds no state,
-- so this table is the only record of why anyone was routed where.
--
-- No foreign key to ig_contacts on purpose: the External Request may be sent
-- without a subscriber_id, and a missing contact row must never cost us a log.
-- ---------------------------------------------------------------------------

create table if not exists public.ig_qualifications (
  id            bigint generated always as identity primary key,
  subscriber_id text,
  ig_username   text,
  raw_text      text,
  age           text,
  work_status   text,
  country       text,
  country_tier  text,
  status        text not null,
  marital       text,
  reason        text,
  created_at    timestamptz not null default now()
);

create index if not exists ig_qualifications_created_idx
  on public.ig_qualifications (created_at desc);

alter table public.ig_qualifications enable row level security;

-- ---------------------------------------------------------------------------
-- 2026-08-06: follow-ups — someone who already finished the funnel wrote back.
--
-- The funnel ends by removing both tags, so a later DM from that person fails
-- the tag gate and flow 2 exits in silence. That silence is correct — the bot
-- must never answer a question in Ali's voice — but nobody was told, so a
-- qualified lead replying "I don't want Telegram" simply went unanswered.
--
-- ManyChat now calls /api/manychat/followup on that path. It sends no message;
-- it records the line here and pushes Ali, who answers by hand. One row per
-- inbound message, so a person who writes three times appears three times.
--
-- No foreign key, for the same reason as ig_qualifications: a missing contact
-- row must never cost us the record of a real person asking a real question.
-- ---------------------------------------------------------------------------

create table if not exists public.ig_followups (
  id            bigint generated always as identity primary key,
  subscriber_id text,
  ig_username   text,
  message       text,
  handled       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists ig_followups_created_idx
  on public.ig_followups (created_at desc);

alter table public.ig_followups enable row level security;

-- ---------------------------------------------------------------------------
-- 2026-08-06: the classification log.
--
-- AI Step 1 used to decide ENGAGED vs FAN inside ManyChat, where its answer was
-- invisible until someone read a contact's custom fields. It called a message
-- naming three symptoms a FAN, and nobody would have known. /api/manychat/classify
-- replaces it and writes every call down here, so a wrong judgement is a row
-- Ali can see rather than a lead that quietly went away.
-- ---------------------------------------------------------------------------

create table if not exists public.ig_classifications (
  id             bigint generated always as identity primary key,
  subscriber_id  text,
  ig_username    text,
  raw_text       text,
  classification text not null,
  reason         text,
  created_at     timestamptz not null default now()
);

create index if not exists ig_classifications_created_idx
  on public.ig_classifications (created_at desc);

alter table public.ig_classifications enable row level security;
