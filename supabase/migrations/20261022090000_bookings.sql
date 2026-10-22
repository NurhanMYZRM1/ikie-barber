-- Run after the initial migration. Adds customer bookings and midnight closing.

-- A closing time of 00:00 means "until midnight" (end of the same day).
alter table public.weekly_hours drop constraint valid_opening_hours;
alter table public.weekly_hours add constraint valid_opening_hours
  check (close_time > open_time or close_time = '00:00');
alter table public.weekly_hours drop constraint valid_break;
alter table public.weekly_hours add constraint valid_break check (
  (break_start is null and break_end is null) or
  (break_start is not null and break_end is not null and
   break_start > open_time and break_end > break_start and
   (break_end < close_time or close_time = '00:00')));

-- One row per booked slot. The unique start time is what prevents double booking.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_start timestamptz not null unique,
  name text not null check (char_length(name) between 1 and 60),
  phone text not null check (phone ~ '^[1-9][0-9]{6,14}$'),
  area text not null check (area in ('Shop', 'Putrajaya', 'Cyberjaya', 'Bangi')),
  address text check (char_length(address) <= 300),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  -- coalesce: a NULL check result would otherwise pass.
  constraint house_call_address check (area = 'Shop' or coalesce(char_length(address), 0) > 0)
);

-- Direct API calls cannot bypass the form: only future, half-hour slots within a month.
create function private.validate_booking() returns trigger language plpgsql
security invoker set search_path = '' as $$
begin
  if new.slot_start <= statement_timestamp()
    or new.slot_start > statement_timestamp() + interval '31 days'
    -- Exact check: casting to bigint would round 3:29:59.6 up to 3:30:00.
    or mod(extract(epoch from new.slot_start), 1800) <> 0 then
    raise exception 'Choose an available half-hour slot.';
  end if;
  new.created_at := statement_timestamp();
  return new;
end;
$$;
create trigger validate_booking before insert on public.bookings
  for each row execute function private.validate_booking();

alter table public.bookings enable row level security;
-- Visitors may book, and may read ONLY the booked start times (column grant).
-- Names, phones and addresses are readable by the owner alone.
-- The browser supplies the id, so a retry after a lost response is recognised as the
-- same booking (primary key conflict) instead of "slot taken".
grant insert (id, slot_start, name, phone, area, address, note) on public.bookings to anon, authenticated;
grant select (slot_start) on public.bookings to anon;
grant select, delete on public.bookings to authenticated;
create policy "Anyone can book" on public.bookings for insert to anon, authenticated with check (true);
create policy "Visitors see booked times" on public.bookings for select to anon using (true);
create policy "Owner reads bookings" on public.bookings for select to authenticated
  using ((select public.is_shop_owner()));
create policy "Owner cancels bookings" on public.bookings for delete to authenticated
  using ((select public.is_shop_owner()));
