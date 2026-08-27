-- ReFiAI — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Tables: profiles, entitlements, progress. All protected by row-level security
-- so each student can only read/write their own rows.

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: self read" on public.profiles
  for select using (auth.uid () = id);

create policy "profiles: self upsert" on public.profiles
  for insert with check (auth.uid () = id);

create policy "profiles: self update" on public.profiles
  for update using (auth.uid () = id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user ();

-- ---------- entitlements (purchased course parts) ----------
create table if not exists public.entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,           -- e.g. 'part-2', 'part-3'
  source text not null default 'manual', -- 'stripe' | 'manual' | 'promo'
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.entitlements enable row level security;

create policy "entitlements: self read" on public.entitlements
  for select using (auth.uid () = user_id);

-- Writes come from the server (Stripe webhook, service role) or manual grants
-- in the dashboard; students cannot grant themselves access.

-- ---------- progress (completed lessons) ----------
create table if not exists public.progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,           -- e.g. 'lesson-3-2'
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.progress enable row level security;

create policy "progress: self read" on public.progress
  for select using (auth.uid () = user_id);

create policy "progress: self insert" on public.progress
  for insert with check (auth.uid () = user_id);

create policy "progress: self delete" on public.progress
  for delete using (auth.uid () = user_id);
