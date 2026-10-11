-- ซิงก์สินค้าจาก Loyverse (POS หน้าร้าน) เข้าเว็บ
--   - ทุก 15 นาที: หักยอดขายเว็บใน Loyverse → ดึงสต็อก/ราคาจาก Loyverse มาอัปเดตตาราง products
--   - จับคู่ด้วย loyverse_variant_id (จำไว้หลังจับคู่ครั้งแรก) หรือ SKU
--   - สินค้าใหม่ใน Loyverse → สร้างบนเว็บแบบซ่อน (active = false) ให้แอดมินใส่รูป/หมวดก่อนเปิดขาย
-- ฟังก์ชัน loyverse-web-sync ใช้ secret LOYVERSE_TOKEN (และ LOYVERSE_STORE_ID ถ้ามีหลายสาขา)
-- (คนละตัวกับ loyverse-sync ที่คัดลอกข้อมูล Loyverse ทั้งหมดไป schema loyverse ทุก 10 นาทีสำหรับรายงาน)

alter table public.products
  add column if not exists loyverse_variant_id text unique,
  add column if not exists loyverse_synced_at timestamptz;

-- ออเดอร์เว็บที่หักสต็อกใน Loyverse แล้ว (null = ยังไม่หัก)
alter table public.orders
  add column if not exists loyverse_synced_at timestamptz;

-- ค่าตั้ง (แถวเดียว) — auto_sync ปิดไว้ก่อนจนกว่าจะทดลองซิงก์ (dry run) แล้วผลถูกต้อง
-- enabled_at: หักสต็อกเฉพาะออเดอร์เว็บที่เกิดหลังเปิดซิงก์ (ออเดอร์เก่าถือว่าจัดการไปแล้ว)
create table if not exists public.loyverse_settings (
  id boolean primary key default true check (id),
  auto_sync boolean not null default false,
  sync_price boolean not null default true,
  create_missing boolean not null default true,
  enabled_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.loyverse_settings (id) values (true) on conflict do nothing;

-- บันทึกการซิงก์แต่ละรอบ
create table if not exists public.loyverse_sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null,               -- cron / manual
  dry_run boolean not null default false,
  ok boolean,
  store_name text,
  loyverse_items int,
  matched int,
  updated int,                         -- สินค้าที่สต็อกหรือราคาเปลี่ยน
  created int,                         -- สินค้าใหม่ที่สร้างแบบซ่อน
  orders_pushed int,                   -- ออเดอร์เว็บที่หักใน Loyverse แล้ว
  changes jsonb,                       -- [{name, field, from, to}]
  unmatched_web jsonb,                 -- สินค้าบนเว็บที่หาใน Loyverse ไม่เจอ
  warnings jsonb,
  error text
);
create index if not exists loyverse_sync_runs_started_idx on public.loyverse_sync_runs (started_at desc);

alter table public.loyverse_settings enable row level security;
alter table public.loyverse_sync_runs enable row level security;
-- ไม่มี policy = เข้าถึงได้เฉพาะ service role (Edge Function / API แอดมิน)

-- ให้หน้าแอดมินสั่งซิงก์ได้ทันที (เรียกผ่าน service role เท่านั้น) — ส่งรหัสลับจาก Vault ให้เอง
create or replace function public.loyverse_sync_now(p_dry_run boolean default false)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://mkexidyjjnasyyeqcsvf.supabase.co/functions/v1/loyverse-web-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'chatbot_cron_secret')
    ),
    body := jsonb_build_object('trigger', 'manual', 'dry_run', p_dry_run),
    timeout_milliseconds := 120000
  );
$$;
revoke all on function public.loyverse_sync_now(boolean) from public, anon, authenticated;
grant execute on function public.loyverse_sync_now(boolean) to service_role;

-- ทุก 15 นาที (ฟังก์ชันจะข้ามเองถ้า auto_sync ยังปิด)
select cron.schedule(
  'loyverse-web-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://mkexidyjjnasyyeqcsvf.supabase.co/functions/v1/loyverse-web-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'chatbot_cron_secret')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
