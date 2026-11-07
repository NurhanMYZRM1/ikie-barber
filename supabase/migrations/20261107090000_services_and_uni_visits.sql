-- Run after the earlier migrations. Moves the price list into the database and adds
-- owner-managed services, house-call areas, extra charges and uni visits. Bookings gain an
-- end time, a type, and a copy of what was agreed. Existing bookings and earnings are
-- kept; older bookings never had a recorded price, so none is invented for them.

alter table public.shop_settings add column instagram_url text not null default ''
  check (instagram_url = '' or instagram_url ~ '^https://');
update public.shop_settings set instagram_url = 'https://www.instagram.com/ikiekentang_/';
grant select (instagram_url) on public.shop_settings to anon;

-- Services: reuse the legacy table. Its seeded samples were never real prices.
update public.services set is_active = false where id in (
  '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003');
alter table public.services rename column price to shop_price; -- blank = not at the shop
alter table public.services alter column shop_price drop not null;
alter table public.services
  add column description text not null default '' check (char_length(description) <= 200),
  add column university_price numeric(10,2)
    check (university_price >= 0 and university_price <> 'NaN'::numeric),
  -- House-call price per area: {"<area id>": 20}. A missing area means not offered there.
  add column area_prices jsonb not null default '{}' check (jsonb_typeof(area_prices) = 'object');

create table public.house_call_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.extra_charges (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 80),
  amount numeric(10,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  -- At most one rule. With none, the charge is only listed and arranged on WhatsApp.
  starts_from time check (starts_from > '00:00' and mod(extract(epoch from starts_from), 900) = 0),
  notice_hours integer check (notice_hours between 1 and 168),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  constraint one_rule check (starts_from is null or notice_hours is null)
);

create table public.university_visits (
  id uuid primary key default gen_random_uuid(),
  -- Customers book inside starts_at..ends_at; the buffers on either side cover travel and
  -- setup, and the whole reserved_from..reserved_until window is kept free of other bookings.
  reserved_from timestamptz not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reserved_until timestamptz not null,
  area_label text not null check (char_length(area_label) between 1 and 80),
  meeting_point text not null default '' check (char_length(meeting_point) <= 300),
  map_url text not null default '' check (map_url = '' or map_url ~ '^https://'),
  -- Services offered: {"<service id>": 8}, or null to use that service's uni price.
  services jsonb not null default '{}' check (jsonb_typeof(services) = 'object'),
  is_open boolean not null default true,
  constraint visit_order check (
    reserved_from <= starts_at and starts_at < ends_at and ends_at <= reserved_until and
    reserved_until - reserved_from <= interval '24 hours'),
  constraint visit_half_hours check (
    mod(extract(epoch from starts_at), 1800) = 0 and mod(extract(epoch from ends_at), 1800) = 0),
  -- One barber: visits, buffers included, never overlap each other.
  constraint one_visit_at_a_time exclude using gist (tstzrange(reserved_from, reserved_until) with &&)
);

-- The price list that used to live in components/price-list.tsx. The owner edits it from
-- now on; extra charges start without rules, so they are listed but never added online.
insert into public.house_call_areas (id, name, sort_order) values
  ('30000000-0000-4000-8000-000000000001', 'Putrajaya', 0),
  ('30000000-0000-4000-8000-000000000002', 'Cyberjaya', 1),
  ('30000000-0000-4000-8000-000000000003', 'Bangi', 2)
on conflict do nothing;
insert into public.services (id, name, shop_price, duration_minutes, sort_order, area_prices)
select id::uuid, name, price, 30, sort_order, '{
    "30000000-0000-4000-8000-000000000001": 20,
    "30000000-0000-4000-8000-000000000002": 25,
    "30000000-0000-4000-8000-000000000003": 35}'::jsonb
from (values ('20000000-0000-4000-8000-000000000001', 'Haircut', 8, 0),
  ('20000000-0000-4000-8000-000000000002', 'Adult haircut', 10, 1)) as list(id, name, price, sort_order)
on conflict do nothing;
insert into public.extra_charges (label, amount, sort_order) values
  ('Late night (after 12 am)', 5, 0),
  ('Last minute / urgent', 10, 1);

-- Bookings: a type, an end time, and a copy of what the customer agreed to.
alter table public.bookings
  alter column area drop not null,
  drop constraint bookings_area_check,
  drop constraint house_call_address,
  drop constraint bookings_slot_start_key,
  add column slot_end timestamptz,
  add column kind text,
  add column area_id uuid references public.house_call_areas (id) on delete set null,
  add column visit_id uuid references public.university_visits (id),
  add column service_id uuid references public.services (id) on delete set null,
  add column service_name text,
  add column price numeric(10,2),
  add column charges jsonb,
  add column total numeric(10,2),
  add column meeting_area text,
  add column meeting_point text,
  add column map_url text;
-- Every earlier booking was a 30-minute slot. `area` now holds only a house call's area name.
update public.bookings set slot_end = slot_start + interval '30 minutes',
  kind = case area when 'Shop' then 'shop' else 'house_call' end,
  area = nullif(area, 'Shop');
update public.bookings b set area_id = a.id from public.house_call_areas a where b.area = a.name;
alter table public.bookings
  alter column slot_end set not null,
  alter column kind set not null,
  add constraint booking_kind check (kind in ('shop', 'house_call', 'university')),
  add constraint house_call_address
    check (kind <> 'house_call' or coalesce(char_length(address), 0) > 0),
  -- One barber: no two appointments of any type overlap. This replaces the unique start
  -- time, and settles two customers booking overlapping times at once.
  add constraint one_customer_at_a_time exclude using gist (tstzrange(slot_start, slot_end) with &&);

-- The database, not the browser, decides a booking's length, price and place, because
-- anyone can insert through the public API. SECURITY DEFINER lets it copy the visit's
-- private meeting point into the booking; search_path is empty and every name qualified.
create or replace function private.validate_booking() returns trigger language plpgsql
security definer set search_path = '' as $$
declare
  shop record;
  service public.services;
  visit public.university_visits;
  day public.weekly_hours;
  local_start timestamp;
  local_end timestamp;
  base numeric;
  extra numeric;
begin
  -- Bookings and visit edits take turns, so the cross-table checks below cannot race.
  perform pg_advisory_xact_lock(7243);
  -- A retry of a booking that already saved: report the duplicate id and nothing else.
  if exists (select 1 from public.bookings where id = new.id) then
    raise exception using errcode = 'unique_violation', message = 'Booking already saved.';
  end if;
  select timezone, is_available, unavailable_until, address, maps_url into shop
    from public.shop_settings where id = 1;
  select * into service from public.services where id = new.service_id and is_active;
  if service.id is null then
    raise exception 'Choose an available service.';
  end if;
  new.created_at := statement_timestamp();
  new.slot_end := new.slot_start + make_interval(mins => service.duration_minutes);
  local_start := new.slot_start at time zone shop.timezone;
  local_end := new.slot_end at time zone shop.timezone;
  -- Exact half hours only: casting to bigint would round 3:29:59.6 up to 3:30:00.
  -- Away mode pauses every kind of booking until its return date.
  if new.slot_start <= new.created_at
    or mod(extract(epoch from new.slot_start), 1800) <> 0
    or not (shop.is_available or
      coalesce((new.created_at at time zone shop.timezone)::date >= shop.unavailable_until, false))
  then
    raise exception 'Choose an available time.';
  end if;

  if new.kind = 'university' then
    select * into visit from public.university_visits where id = new.visit_id;
    if not coalesce(visit.is_open, false)
      or new.slot_start < visit.starts_at or new.slot_end > visit.ends_at then
      raise exception 'Choose an available time.';
    end if;
    -- A visit's own price wins over the service's uni price.
    if visit.services ? service.id::text then
      base := coalesce((visit.services ->> service.id::text)::numeric, service.university_price);
    end if;
    new.meeting_area := visit.area_label;
    new.meeting_point := visit.meeting_point;
    new.map_url := visit.map_url;
    new.area_id := null;
    new.area := null;
    new.address := null;
  else
    select * into day from public.weekly_hours
      where day_of_week = extract(isodow from local_start)::int - 1;
    -- Inside opening hours (closing at 00:00 means midnight), clear of the break and of
    -- every visit's reserved window, and at most 31 days ahead.
    if not coalesce(day.is_open, false)
      or new.slot_start > new.created_at + interval '31 days'
      or local_start::time < day.open_time
      or local_end > local_start::date + (case when day.close_time = '00:00'
        then interval '24 hours' else day.close_time::interval end)
      or (day.break_start is not null
        and local_start < local_start::date + day.break_end
        and local_end > local_start::date + day.break_start)
      or exists (select 1 from public.university_visits v
        where tstzrange(v.reserved_from, v.reserved_until) && tstzrange(new.slot_start, new.slot_end))
    then
      raise exception 'Choose an available time.';
    end if;
    new.visit_id := null;
    new.meeting_area := null;
    new.meeting_point := null;
    new.map_url := null;
    if new.kind = 'house_call' then
      select name into new.area from public.house_call_areas where id = new.area_id and is_active;
      if found then
        base := (service.area_prices ->> new.area_id::text)::numeric;
      end if;
    else
      base := service.shop_price;
      new.meeting_point := shop.address;
      new.map_url := shop.maps_url;
      new.area_id := null;
      new.area := null;
      new.address := null;
    end if;
  end if;
  if base is null then
    raise exception 'Choose an available service.';
  end if;

  -- Mirrors lib/pricing.ts: rule-based extras are added to what the customer was shown.
  select coalesce(jsonb_agg(jsonb_build_object('label', c.label, 'amount', c.amount)
      order by c.sort_order, c.label), '[]'), coalesce(sum(c.amount), 0)
    into new.charges, extra
    from public.extra_charges c
    where c.is_active and (local_start::time >= c.starts_from
      or new.slot_start - new.created_at < make_interval(hours => c.notice_hours));
  new.service_name := service.name;
  new.price := base;
  -- The customer agreed to the total they saw. Any other total means prices just changed.
  if new.total is distinct from base + extra then
    raise exception 'Price changed.';
  end if;
  return new;
end;
$$;

-- Visits are checked against bookings the owner can already read, so invoker rights do.
create function private.validate_visit() returns trigger language plpgsql
security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(7243);
  -- Uni customers confirm their meeting point on WhatsApp, so an open visit needs the number.
  if new.is_open and (select whatsapp_number from public.shop_settings where id = 1) = '' then
    raise exception 'Add your WhatsApp number in Settings before opening a visit.';
  end if;
  -- Nothing else may sit inside the reserved window, and the visit's own bookings must
  -- still fit its hours: an edit cannot strand a customer.
  if exists (select 1 from public.bookings b
      where tstzrange(b.slot_start, b.slot_end) && tstzrange(new.reserved_from, new.reserved_until)
        and b.visit_id is distinct from new.id)
    or exists (select 1 from public.bookings b
      where b.visit_id = new.id and (b.slot_start < new.starts_at or b.slot_end > new.ends_at))
  then
    raise exception 'This visit clashes with booked appointments.';
  end if;
  return new;
end;
$$;
create trigger validate_visit before insert or update on public.university_visits
  for each row execute function private.validate_visit();

create or replace function private.validate_settings() returns trigger language plpgsql
security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(7243);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Choose a valid IANA timezone.';
  end if;
  if new.whatsapp_number = ''
    and exists (select 1 from public.university_visits where is_open and ends_at > now()) then
    raise exception 'Keep your WhatsApp number while uni visits are open.';
  end if;
  if new.timezone is distinct from old.timezone and
    (exists (select 1 from public.bookings where slot_end > now()) or
     exists (select 1 from public.university_visits where reserved_until > now())) then
    raise exception 'Resolve upcoming bookings before changing the timezone.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Closing a day or moving its hours/break must not invalidate an agreed appointment.
-- Uni visits have their own hours and are deliberately independent of this schedule.
create function private.protect_booked_hours() returns trigger language plpgsql
security invoker set search_path = '' as $$
declare
  zone text;
begin
  perform pg_advisory_xact_lock(7243);
  select timezone into zone from public.shop_settings where id = 1;
  if exists (
    select 1 from public.bookings b
    cross join lateral (select b.slot_start at time zone zone as start_time,
      b.slot_end at time zone zone as end_time) local_booking
    where b.kind <> 'university' and b.slot_end > now()
      and extract(isodow from start_time)::int - 1 = new.day_of_week
      and (not new.is_open or start_time::time < new.open_time
        or end_time > start_time::date + (case when new.close_time = '00:00'
          then interval '24 hours' else new.close_time::interval end)
        or (new.break_start is not null and start_time < start_time::date + new.break_end
          and end_time > start_time::date + new.break_start))
  ) then
    raise exception 'Resolve affected bookings before changing these hours.';
  end if;
  return new;
end;
$$;
create trigger protect_booked_hours before update on public.weekly_hours
  for each row execute function private.protect_booked_hours();
-- The app edits days in place; removing a day would bypass the protection above.
revoke delete on public.weekly_hours from authenticated;

-- Directions for whoever holds the booking (ids are never readable by visitors): the shop
-- address for a shop visit, the proposed meeting point for a uni visit.
create or replace function public.booking_directions(booking_id uuid)
returns table (address text, maps_url text)
language sql
stable
security definer
set search_path = ''
as $$
  -- New shop bookings keep their original address; legacy ones have no snapshot.
  select coalesce(b.meeting_point, s.address), coalesce(b.map_url, s.maps_url)
  from public.bookings b cross join public.shop_settings s
  where s.id = 1 and b.id = booking_id and b.kind = 'shop'
  union all
  select b.meeting_point, b.map_url
  from public.bookings b
  where b.id = booking_id and b.kind = 'university';
$$;

alter table public.house_call_areas enable row level security;
alter table public.extra_charges enable row level security;
alter table public.university_visits enable row level security;
-- Hosted Supabase grants API roles everything on new tables; grant back only what is used.
-- The legacy services table still had those defaults; RLS alone stood in the way.
revoke all on public.services, public.house_call_areas, public.extra_charges,
  public.university_visits, public.bookings from anon, authenticated;
grant select on public.services, public.house_call_areas, public.extra_charges to anon, authenticated;
grant insert, update, delete on public.services, public.house_call_areas, public.extra_charges
  to authenticated;
-- The exact meeting point and map link are given out only after booking.
grant select (id, reserved_from, starts_at, ends_at, reserved_until, area_label, services, is_open)
  on public.university_visits to anon;
grant select, insert, update, delete on public.university_visits to authenticated;
-- Visitors may read booked times only. The trigger fills in everything else.
grant insert (id, slot_start, kind, service_id, area_id, visit_id, name, phone, address, note, total)
  on public.bookings to anon, authenticated;
grant select (slot_start, slot_end) on public.bookings to anon;
grant select, delete on public.bookings to authenticated;

create policy "Public areas" on public.house_call_areas for select to anon, authenticated
  using (is_active);
create policy "Owner manages areas" on public.house_call_areas for all to authenticated
  using ((select public.is_shop_owner())) with check ((select public.is_shop_owner()));
create policy "Public extra charges" on public.extra_charges for select to anon, authenticated
  using (is_active);
create policy "Owner manages extra charges" on public.extra_charges for all to authenticated
  using ((select public.is_shop_owner())) with check ((select public.is_shop_owner()));
create policy "Public visits" on public.university_visits for select to anon using (true);
create policy "Owner manages visits" on public.university_visits for all to authenticated
  using ((select public.is_shop_owner())) with check ((select public.is_shop_owner()));
