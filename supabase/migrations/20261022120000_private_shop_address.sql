-- The shop address is revealed only after a booking. Visitors could read it straight
-- from the API, so hide it (and the map link) column by column; the owner keeps full access.
revoke all on public.shop_settings from anon;
grant select (id, name, description, whatsapp_number, logo_url, timezone, currency,
  is_available, unavailable_until, unavailable_note) on public.shop_settings to anon;

-- Directions for whoever holds a shop-visit booking. Booking ids are never readable by
-- visitors, so knowing one means you made that booking.
create function public.booking_directions(booking_id uuid)
returns table (address text, maps_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.address, s.maps_url
  from public.shop_settings s
  where s.id = 1
    and exists (
      select 1 from public.bookings b where b.id = booking_id and b.area = 'Shop'
    );
$$;
revoke all on function public.booking_directions(uuid) from public;
grant execute on function public.booking_directions(uuid) to anon, authenticated;
