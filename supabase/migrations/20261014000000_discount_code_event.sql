-- โค้ดส่วนลดผูกกับงานจองโต๊ะงานเดียวได้ (booth_events) — เว้นว่าง = ใช้ได้ทุกงาน
alter table public.discount_codes add column if not exists event_id uuid;
alter table public.discount_codes drop constraint if exists discount_codes_event_id_fkey;
update public.discount_codes set event_id = null where event_id is not null and event_id not in (select id from public.booth_events);
alter table public.discount_codes add constraint discount_codes_event_id_fkey
  foreign key (event_id) references public.booth_events(id) on delete set null;
