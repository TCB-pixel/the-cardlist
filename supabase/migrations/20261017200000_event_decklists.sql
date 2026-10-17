-- ส่ง Decklist ลงทัวร์ + ฐานข้อมูลการแข่งของร้าน (เจ้าของยืนยันภาคผนวก C 17 ต.ค. 2026)
-- "ข้อมูลทั้งหมดจะเก็บเข้าหลังบ้าน เวลามีแข่ง เราจะได้เก็บฐานข้อมูลไว้ได้"
--
-- หลักการ
-- · decklist ที่ส่งแล้วเก็บถาวรเป็นสำเนา (snapshot) — ผู้เล่นแก้/ลบเด็คต้นฉบับภายหลังไม่กระทบ
-- · ลบบัญชี/ลบอีเวนต์ไม่ลบ decklist: ตัดการผูก (set null) แต่เก็บชื่อเล่นตอนแข่ง ชื่องาน และวันที่ไว้
-- · ผู้เล่นเห็นเฉพาะของตัวเอง · เขียนผ่าน API ฝั่ง server เท่านั้น (ตรวจเวลาปิดรับ กติกา และความยินยอม) · staff ใช้ service role
-- · ไม่มีราคาหรือมูลค่าการ์ด

-- ตั้งค่าการรับ decklist ต่ออีเวนต์
alter table public.events
  add column if not exists decklist_enabled boolean not null default false,
  add column if not exists decklist_deadline timestamptz,
  add column if not exists decklist_game text,          -- เกมที่ใช้ตรวจกติกา (ว่าง = ใช้ events.tcg)
  add column if not exists decklist_regulation text;    -- เช่น "H, I, J" (Pokémon regulation mark ที่อนุญาต)

create table public.event_decklists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  -- สำเนาข้อมูลตอนส่ง (อยู่ต่อได้แม้อีเวนต์/บัญชีถูกลบ)
  event_title text not null,
  event_date date,
  player_name text not null check (char_length(player_name) between 1 and 60),
  game text not null,
  format text not null default '',
  deck_name text not null default '',
  cards jsonb not null default '[]'::jsonb,   -- [{card_name, card_number, quantity, card_id, card_type, color, image_url, regulation}]
  card_count integer not null default 0,
  deck_code text not null default '' check (char_length(deck_code) <= 120), -- รหัสเด็คจากเว็บ Pokémon (เก็บเป็นข้อความ)
  rule_issues jsonb not null default '[]'::jsonb,
  -- สถานะ / ตรวจโดย staff
  status text not null default 'submitted' check (status in ('submitted', 'checked', 'rejected')),
  staff_note text not null default '',
  checked_by text,
  checked_at timestamptz,
  -- ผลการแข่ง
  placement integer check (placement is null or placement > 0),
  top_cut boolean not null default false,
  -- PDPA: ยินยอมให้ร้านเก็บ decklist และผลการแข่ง
  consent_version text not null,
  consent_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1 คน 1 decklist ต่ออีเวนต์ (ส่งซ้ำ = แก้ของเดิมจนกว่าจะปิดรับ)
create unique index event_decklists_event_user_idx on public.event_decklists (event_id, user_id)
  where event_id is not null and user_id is not null;
create index event_decklists_game_idx on public.event_decklists (game, submitted_at desc);
create index event_decklists_user_idx on public.event_decklists (user_id);

alter table public.event_decklists enable row level security;
create policy "Players can view own decklists" on public.event_decklists
  for select using (auth.uid() = user_id);
