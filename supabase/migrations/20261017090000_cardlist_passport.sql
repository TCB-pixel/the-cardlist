-- CARDLIST PASSPORT — สะสมแสตมป์ดิจิทัล 3 งาน (Hallowcard · Discover Your Card · The Community of Card)
-- ตารางใหม่ทั้งหมด ไม่แตะตารางเดิม · เปิด RLS ไม่มี policy = เข้าถึงผ่าน API ฝั่ง server (service role) เท่านั้น
-- ข้อมูลส่วนบุคคล: ไม่เก็บชื่อ เบอร์ อีเมล · passports เก็บแค่รหัสการ์ด + hash ของรหัสบนเครื่อง

-- pgcrypto อยู่ใน schema extensions (ค่าเริ่มต้นของ Supabase)

-- ───────── งาน ─────────
create table public.passport_events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  venue text,
  starts_on date not null,
  ends_on date not null,
  open_time time not null default '10:00',
  close_time time not null default '22:00',
  is_test boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ───────── จุดสแกน ─────────
-- track 'passport' = จุดในงาน (ผูกกับงาน) · 'learn' = โต๊ะสอนเล่น (ไม่ผูกงาน สะสมข้ามงานได้)
-- qr_mode 'daily' = ป้ายพิมพ์ เปลี่ยนรายวัน · 'rotating' = QR บนจอ เปลี่ยนทุก 30 วินาที
create table public.passport_stations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  event_id uuid references public.passport_events(id) on delete cascade,
  track text not null check (track in ('passport', 'learn')),
  name text not null,
  logo_path text,
  qr_mode text not null default 'daily' check (qr_mode in ('daily', 'rotating')),
  secret text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  display_key text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  is_test boolean not null default false,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  check (track = 'learn' or event_id is not null)
);

-- ───────── พาสปอร์ต ─────────
-- kind 'card' = การ์ดที่ขาย 100 บาท · 'free' = Learn To Play อย่างเดียว (ไม่ต้องซื้อ)
create table public.passports (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  kind text not null check (kind in ('card', 'free')),
  status text not null default 'unsold' check (status in ('unsold', 'sold', 'active')),
  claim_secret text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  redeem_secret text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  device_hash text,
  user_id uuid references auth.users(id) on delete set null,
  is_test boolean not null default false,
  sold_price int,
  sold_at timestamptz,
  sold_by text,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);
create index passports_device_hash_idx on public.passports(device_hash);

create table public.passport_stamps (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.passports(id) on delete cascade,
  station_id uuid not null references public.passport_stations(id) on delete cascade,
  event_id uuid references public.passport_events(id) on delete set null,
  stamped_at timestamptz not null default now(),
  unique (passport_id, station_id)
);
create index passport_stamps_station_idx on public.passport_stamps(station_id);

-- ───────── รางวัล ─────────
-- track 'passport' = ของในซองลุ้น (สุ่มตามจำนวนที่เหลือ) · 'learn' = ของเมื่อเรียนครบทุกโต๊ะ
create table public.passport_rewards (
  id uuid primary key default gen_random_uuid(),
  track text not null check (track in ('passport', 'learn')),
  tier text not null,
  name text not null,
  color text not null default '#a1a1aa',
  stock int not null default 0 check (stock >= 0),
  initial_stock int not null default 0,
  needs_payment boolean not null default false,
  is_test boolean not null default false,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ซองที่ได้เมื่อครบทุกจุดของงาน (1 ซองต่องาน)
create table public.passport_packs (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.passports(id) on delete cascade,
  event_id uuid references public.passport_events(id) on delete set null,
  source text not null default 'event_complete',
  reward_id uuid references public.passport_rewards(id),
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  unique (passport_id, event_id, source)
);

-- ของที่รอแลก / แลกแล้ว
create table public.passport_redemptions (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.passports(id) on delete cascade,
  reward_id uuid references public.passport_rewards(id),
  pack_id uuid unique references public.passport_packs(id) on delete cascade,
  kind text not null check (kind in ('pack', 'learn_complete')),
  status text not null default 'pending' check (status in ('pending', 'redeemed')),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by text
);
create unique index passport_redemptions_learn_once on public.passport_redemptions(passport_id) where kind = 'learn_complete';

alter table public.passport_events enable row level security;
alter table public.passport_stations enable row level security;
alter table public.passports enable row level security;
alter table public.passport_stamps enable row level security;
alter table public.passport_rewards enable row level security;
alter table public.passport_packs enable row level security;
alter table public.passport_redemptions enable row level security;

-- ───────── ฉีกซอง: สุ่มตามจำนวนที่เหลือจริง (ล็อกแถว กันของเกิน) ─────────
create or replace function public.passport_open_pack(p_pack uuid)
returns table (reward_id uuid, tier text, name text, color text)
language plpgsql security definer set search_path = public as $$
declare
  v_pack public.passport_packs;
  v_test boolean;
  v_total int;
  v_r int;
  rec record;
begin
  select * into v_pack from public.passport_packs where id = p_pack for update;
  if not found then raise exception 'pack_not_found'; end if;
  if v_pack.opened_at is not null then raise exception 'pack_opened'; end if;
  select p.is_test into v_test from public.passports p where p.id = v_pack.passport_id;

  perform 1 from public.passport_rewards r
    where r.track = 'passport' and r.is_test = v_test and r.active for update;
  select coalesce(sum(r.stock), 0) into v_total from public.passport_rewards r
    where r.track = 'passport' and r.is_test = v_test and r.active and r.stock > 0;
  if v_total = 0 then raise exception 'pool_empty'; end if;

  v_r := floor(random() * v_total)::int;
  for rec in
    select r.* from public.passport_rewards r
    where r.track = 'passport' and r.is_test = v_test and r.active and r.stock > 0
    order by r.sort
  loop
    if v_r < rec.stock then
      update public.passport_rewards set stock = stock - 1 where id = rec.id;
      update public.passport_packs set opened_at = now(), reward_id = rec.id where id = p_pack;
      insert into public.passport_redemptions (passport_id, reward_id, pack_id, kind)
        values (v_pack.passport_id, rec.id, p_pack, 'pack');
      return query select rec.id, rec.tier, rec.name, rec.color;
      return;
    end if;
    v_r := v_r - rec.stock;
  end loop;
  raise exception 'pool_empty';
end $$;

-- ───────── เรียนครบทุกโต๊ะ: ให้ของรางวัล Learn To Play (ครั้งเดียวต่อพาสปอร์ต) ─────────
create or replace function public.passport_grant_learn(p_passport uuid)
returns table (redemption_id uuid, reward_id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare
  v_test boolean;
  v_reward public.passport_rewards;
  v_id uuid;
begin
  select p.is_test into v_test from public.passports p where p.id = p_passport for update;
  if not found then raise exception 'passport_not_found'; end if;
  if exists (select 1 from public.passport_redemptions x where x.passport_id = p_passport and x.kind = 'learn_complete') then
    return;
  end if;
  select r.* into v_reward from public.passport_rewards r
    where r.track = 'learn' and r.is_test = v_test and r.active and r.stock > 0
    order by r.sort limit 1 for update;
  if found then
    update public.passport_rewards set stock = stock - 1 where id = v_reward.id;
  end if;
  insert into public.passport_redemptions (passport_id, reward_id, kind)
    values (p_passport, v_reward.id, 'learn_complete') returning id into v_id;
  return query select v_id, v_reward.id, v_reward.name;
end $$;

revoke all on function public.passport_open_pack(uuid) from public, anon, authenticated;
revoke all on function public.passport_grant_learn(uuid) from public, anon, authenticated;
grant execute on function public.passport_open_pack(uuid) to service_role;
grant execute on function public.passport_grant_learn(uuid) to service_role;

-- ───────── ข้อมูลตั้งต้น (แก้ได้ในหน้าแอดมิน) ─────────
-- เวลาเปิด-ปิดงาน 10:00–22:00 เป็นค่าเริ่มต้น ยังไม่ได้ยืนยันกับห้าง
insert into public.passport_events (slug, name, venue, starts_on, ends_on, sort) values
  ('hallowcard', 'Hallowcard Party', 'Siam Discovery ชั้น 3', '2026-10-31', '2026-11-01', 1),
  ('discover', 'Discover Your Card', 'Siam Discovery ชั้น 3', '2026-11-07', '2026-11-08', 2),
  ('community', 'The Community of Card', 'Siam Paragon · Infinicity Hall ชั้น 5', '2026-11-20', '2026-11-22', 3);
insert into public.passport_events (slug, name, venue, starts_on, ends_on, open_time, close_time, is_test, sort) values
  ('test', 'TEST · ทดสอบระบบ', 'ทดสอบ', '2026-10-17', '2026-10-30', '00:00', '23:59:59', true, 9);

-- จุดในงาน 4 จุดต่องาน (รอเจ้าของยืนยันรายชื่อ)
insert into public.passport_stations (code, event_id, track, name, is_test, sort)
select e.prefix || '-' || s.code, ev.id, 'passport', s.name, ev.is_test, s.sort
from (values ('hallowcard', 'HW'), ('discover', 'DY'), ('community', 'CC'), ('test', 'T')) as e(slug, prefix)
join public.passport_events ev on ev.slug = e.slug
cross join (values ('BOOTH', 'บูธ The Cardlist', 1), ('PULL', 'PULL OF THE DAY', 2), ('STAGE', 'เวที (Stage)', 3), ('SPONSOR', 'จุดสปอนเซอร์', 4)) as s(code, name, sort);

-- โต๊ะสอนเล่น 5 เกม (ตัวอย่าง — รอเจ้าของยืนยันเกมจริง) · QR บนจอคนสอน เปลี่ยนทุก 30 วินาที
insert into public.passport_stations (code, event_id, track, name, logo_path, qr_mode, is_test, sort)
select p.prefix || '-' || g.code, null, 'learn', g.name, '/images/passport/games/' || g.logo || '.png', 'rotating', p.is_test, g.sort
from (values ('L', false), ('TL', true)) as p(prefix, is_test)
cross join (values ('POKEMON', 'Pokémon', 'pokemon', 1), ('ONEPIECE', 'One Piece', 'one-piece', 2), ('MAGIC', 'Magic: The Gathering', 'magic', 3),
                   ('GUNDAM', 'Gundam Card Game', 'gundam', 4), ('UNIONARENA', 'Union Arena', 'union-arena', 5)) as g(code, name, logo, sort);

-- ของรางวัลจริง: จำนวน SUPER RARE / EPIC / LEGENDARY / ชุดเพลย์แมท = 0 จนกว่าเจ้าของกำหนด (จำนวน 0 = ไม่ถูกสุ่ม)
insert into public.passport_rewards (track, tier, name, color, stock, initial_stock, needs_payment, is_test, sort) values
  ('passport', 'COMMON', 'สติกเกอร์', '#a1a1aa', 500, 500, false, false, 1),
  ('passport', 'RARE', 'สลีฟ', '#3b82f6', 80, 80, false, false, 2),
  ('passport', 'SUPER RARE', 'สลีฟ One Piece / Pokémon หรือซอง Pokémon เงามืดคุกคาม', '#a855f7', 0, 0, false, false, 3),
  ('passport', 'EPIC', 'สิทธิ์ซื้อ One Piece OP17 ราคาป้าย', '#ef4444', 0, 0, true, false, 4),
  ('passport', 'LEGENDARY', 'สิทธิ์ซื้อ Pokémon 30 ปี ราคาป้าย', '#e9d29a', 0, 0, true, false, 5),
  ('learn', 'COMPLETE', 'ชุดเพลย์แมท The Cardlist', '#e9d29a', 0, 0, false, false, 1);

-- ของรางวัลชุดทดสอบ (แยกจากของจริง ไม่ตัดสต็อกจริง)
insert into public.passport_rewards (track, tier, name, color, stock, initial_stock, needs_payment, is_test, sort) values
  ('passport', 'COMMON', '[TEST] สติกเกอร์', '#a1a1aa', 50, 50, false, true, 1),
  ('passport', 'RARE', '[TEST] สลีฟ', '#3b82f6', 20, 20, false, true, 2),
  ('passport', 'SUPER RARE', '[TEST] สลีฟ / ซองเงามืดคุกคาม', '#a855f7', 10, 10, false, true, 3),
  ('passport', 'EPIC', '[TEST] สิทธิ์ซื้อ OP17 ราคาป้าย', '#ef4444', 5, 5, true, true, 4),
  ('passport', 'LEGENDARY', '[TEST] สิทธิ์ซื้อ Pokémon 30 ปี ราคาป้าย', '#e9d29a', 5, 5, true, true, 5),
  ('learn', 'COMPLETE', '[TEST] ชุดเพลย์แมท', '#e9d29a', 10, 10, false, true, 1);
