-- Run this in Supabase Dashboard > SQL Editor.
-- Replaces the old open-access schedules table with a per-user, RLS-protected one.

drop table if exists schedules;

create table schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('daily', 'monthly', 'yearly')),
  -- The day for daily plans, first of the month for monthly, Jan 1 for yearly.
  period_start date not null,
  title text not null default '',
  requirement text not null default '',
  -- Daily items: {name, start, end}. Monthly: {name, day}. Yearly: {name, month}.
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index schedules_user_type_period on schedules (user_id, type, period_start desc);

alter table schedules enable row level security;

create policy "owners can select" on schedules
  for select using (auth.uid() = user_id);
create policy "owners can insert" on schedules
  for insert with check (auth.uid() = user_id);
create policy "owners can update" on schedules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owners can delete" on schedules
  for delete using (auth.uid() = user_id);

-- Keep updated_at fresh on edits.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger schedules_updated_at
  before update on schedules
  for each row execute function set_updated_at();
