-- COLLECTION TRACKER + DECK BUILDER — บันทึกโครงสร้างที่มีอยู่แล้วในฐานข้อมูลจริง (17 ต.ค. 2026)
-- สองตารางนี้เคยสร้างตรงในฐานข้อมูลโดยไม่มีไฟล์ migration — ไฟล์นี้จดไว้ให้ตรงกับของจริงก่อนจะแก้โครงสร้างในเฟสถัดไป
-- เขียนแบบรันซ้ำได้: บนฐานข้อมูลจริงจะไม่เปลี่ยนอะไร · บนฐานข้อมูลใหม่จะสร้างให้เหมือนของจริง

create extension if not exists "uuid-ossp";

create table if not exists public.collection_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_name text not null,
  set_name text not null default '',
  card_number text not null default '',
  tcg text not null default 'One Piece',
  rarity text not null default 'Rare',
  condition text not null default 'NM',
  quantity integer not null default 1,
  note text not null default '',
  created_at timestamptz default now()
);

-- การ์ดในเด็คเก็บเป็น JSON [{card_name, quantity, card_number?}] — เฟส 3 จะย้ายไปตาราง deck_cards
create table if not exists public.decks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  tcg text not null default 'One Piece',
  format text not null default 'Standard',
  description text not null default '',
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ลูกค้าเห็น/แก้ได้เฉพาะของตัวเอง
alter table public.collection_cards enable row level security;
alter table public.decks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collection_cards' and policyname = 'Users can view own collection') then
    create policy "Users can view own collection" on public.collection_cards for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collection_cards' and policyname = 'Users can insert own collection') then
    create policy "Users can insert own collection" on public.collection_cards for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collection_cards' and policyname = 'Users can update own collection') then
    create policy "Users can update own collection" on public.collection_cards for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collection_cards' and policyname = 'Users can delete own collection') then
    create policy "Users can delete own collection" on public.collection_cards for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'decks' and policyname = 'Users can view own decks') then
    create policy "Users can view own decks" on public.decks for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'decks' and policyname = 'Users can insert own decks') then
    create policy "Users can insert own decks" on public.decks for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'decks' and policyname = 'Users can update own decks') then
    create policy "Users can update own decks" on public.decks for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'decks' and policyname = 'Users can delete own decks') then
    create policy "Users can delete own decks" on public.decks for delete using (auth.uid() = user_id);
  end if;
end $$;
