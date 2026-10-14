-- โค้ดส่วนลดผูกกับงานเดียวได้ (เว้นว่าง = ใช้ได้ทุกงาน)
alter table public.discount_codes
  add column if not exists event_id uuid references public.events(id) on delete set null;
