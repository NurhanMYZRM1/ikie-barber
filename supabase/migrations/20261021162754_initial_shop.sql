-- Run once in a fresh Supabase project. All amounts are stored as decimal currency.
-- Owner authorization is a private UUID allowlist, NOT 'any signed-in account'.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.shop_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table private.shop_owner enable row level security;
grant select on private.shop_owner to authenticated;
create policy "Owner can check their membership" on private.shop_owner
  for select to authenticated using (user_id = (select auth.uid()));

-- Invoker security keeps RLS active even inside this authorization helper.
create function public.is_shop_owner() returns boolean language sql stable
security invoker set search_path = '' as $$
  select exists (select 1 from private.shop_owner where user_id = (select auth.uid()));
$$;
revoke all on function public.is_shop_owner() from public, anon;
grant execute on function public.is_shop_owner() to authenticated;

create table public.shop_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Aqil Barber' check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  address text not null default '' check (char_length(address) <= 300),
  maps_url text not null default '' check (maps_url = '' or maps_url ~ '^https://'),
  whatsapp_number text not null default '' check (whatsapp_number = '' or whatsapp_number ~ '^[1-9][0-9]{6,14}$'),
  logo_url text not null default '' check (logo_url = '' or logo_url ~ '^https://'),
  timezone text not null default 'Asia/Kuala_Lumpur',
  currency text not null default 'MYR' check (currency in ('MYR', 'SGD', 'USD', 'GBP', 'EUR', 'AUD')),
  is_available boolean not null default true,
  unavailable_until date,
  unavailable_note text check (char_length(unavailable_note) <= 140),
  updated_at timestamptz not null default now()
);

create table public.weekly_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  open_time time not null default '10:00',
  close_time time not null default '21:00',
  break_start time,
  break_end time,
  constraint valid_opening_hours check (close_time > open_time),
  constraint quarter_hour_times check (
    mod(extract(epoch from open_time), 900) = 0 and
    mod(extract(epoch from close_time), 900) = 0 and
    (break_start is null or mod(extract(epoch from break_start), 900) = 0) and
    (break_end is null or mod(extract(epoch from break_end), 900) = 0)),
  constraint valid_break check (
    (break_start is null and break_end is null) or
    (break_start is not null and break_end is not null and
     break_start > open_time and break_end > break_start and break_end < close_time))
);

create table public.earnings (
  id uuid primary key default gen_random_uuid(),
  amount numeric(10,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  note text check (char_length(note) <= 200),
  payment_method text check (payment_method in ('Cash', 'QR', 'Card')),
  business_date date not null,
  created_at timestamptz not null default now()
);
create index earnings_business_date_idx on public.earnings (business_date desc, created_at desc);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  price numeric(10,2) not null check (price >= 0 and price <> 'NaN'::numeric),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

-- Validate timezone in Postgres too: direct API calls cannot bypass the form.
create function private.validate_settings() returns trigger language plpgsql
security invoker set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Choose a valid IANA timezone.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger validate_settings before insert or update on public.shop_settings
  for each row execute function private.validate_settings();

-- Midnight NEVER deletes money records. The database assigns the shop-local date
-- on insertion; editing an old entry preserves its original business date.
-- This also guards against a phone/server having the wrong clock or forged input.
create function private.stamp_earning_date() returns trigger language plpgsql
security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    new.created_at := statement_timestamp();
    new.business_date := (new.created_at at time zone
      (select timezone from public.shop_settings where id = 1))::date;
  else
    new.created_at := old.created_at;
    new.business_date := old.business_date;
  end if;
  return new;
end;
$$;
create trigger stamp_earning_date before insert or update on public.earnings
  for each row execute function private.stamp_earning_date();

alter table public.shop_settings enable row level security;
alter table public.weekly_hours enable row level security;
alter table public.services enable row level security;
alter table public.earnings enable row level security;

-- Every settings field is public shop information. Owner UUID/password live elsewhere.
grant select on public.shop_settings, public.weekly_hours, public.services, public.earnings to anon, authenticated;
grant update on public.shop_settings to authenticated;
grant insert, update, delete on public.weekly_hours, public.services, public.earnings to authenticated;
create policy "Public shop profile" on public.shop_settings for select to anon, authenticated using (true);
create policy "Public hours" on public.weekly_hours for select to anon, authenticated using (true);
create policy "Public active services" on public.services for select to anon, authenticated using (is_active);
create policy "Owner edits profile" on public.shop_settings for update to authenticated
  using ((select public.is_shop_owner())) with check ((select public.is_shop_owner()));
create policy "Owner manages hours" on public.weekly_hours for all to authenticated
  using ((select public.is_shop_owner())) with check ((select public.is_shop_owner()));
create policy "Owner manages services" on public.services for all to authenticated
  using ((select public.is_shop_owner())) with check ((select public.is_shop_owner()));
create policy "Owner alone manages earnings" on public.earnings for all to authenticated
  using ((select public.is_shop_owner())) with check ((select public.is_shop_owner()));

-- Aggregate in SQL, so a busy day with >1,000 entries is still totalled correctly.
-- SECURITY INVOKER means this function has exactly the caller's RLS permissions.
create function public.daily_earnings_totals()
returns table (business_date date, total numeric, entry_count bigint)
language sql stable security invoker set search_path = '' as $$
  select business_date, sum(amount), count(*) from public.earnings
  group by business_date order by business_date desc;
$$;
revoke all on function public.daily_earnings_totals() from public, anon;
grant execute on function public.daily_earnings_totals() to authenticated;

-- Only public tables are streamed; financial data never enters this publication.
-- The conditional makes the same migration runnable in the local Postgres tests.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shop_settings, public.weekly_hours, public.services;
  end if;
end $$;
