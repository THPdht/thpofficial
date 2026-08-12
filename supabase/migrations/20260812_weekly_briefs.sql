-- Weekly tracker brief cache.
-- One row per (client, week ending) holding the AI-generated call-prep brief so
-- reopening a client's CRM panel doesn't re-run the model. Regenerated when the
-- admin asks for it explicitly, or when the client has logged more days since.

create table if not exists weekly_briefs (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  week_end date not null,
  brief jsonb not null,
  day_count int not null default 0,
  generated_at timestamptz not null default now(),
  unique (user_email, week_end)
);

create index if not exists weekly_briefs_user_week_idx
  on weekly_briefs (user_email, week_end desc);

-- Service-role only: every route that reads this table authorizes in lib/apiAuth.ts.
alter table weekly_briefs enable row level security;
