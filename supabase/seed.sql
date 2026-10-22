-- Safe to rerun: the sample data won't overwrite the owner's later changes.
insert into public.shop_settings (id, name, description, address, whatsapp_number)
values (1, 'Ikie Barber', '', 'Kuala Lumpur, Malaysia', '601157878404')
on conflict do nothing;

-- Monday = 0, Sunday = 6. Slots every 30 min: 3:00–6:00 PM and 8:00–11:30 PM.
-- Closing at 00:00 means midnight; the break hides 6:30–7:30 PM.
insert into public.weekly_hours (day_of_week, is_open, open_time, close_time, break_start, break_end)
select day, true, '15:00'::time, '00:00'::time, '18:30'::time, '20:00'::time from generate_series(0, 6) as day
on conflict do nothing;

insert into public.services (id, name, price, duration_minutes, sort_order) values
('10000000-0000-4000-8000-000000000001', 'Signature haircut', 35, 30, 0),
('10000000-0000-4000-8000-000000000002', 'Haircut & beard', 50, 45, 1),
('10000000-0000-4000-8000-000000000003', 'Beard trim', 20, 20, 2)
on conflict do nothing;

-- Do NOT seed earnings or an owner password. Create the owner in Auth, then
-- insert their UUID into private.shop_owner as explained in README.md.
