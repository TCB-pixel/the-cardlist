-- ฐานข้อมูลการ์ด (เฟส 1 Collection Tracker + Deck Builder — เจ้าของยืนยันแผน 17 ต.ค. 2026)
-- ข้อมูลกลางที่ทุกคนอ่านได้ ดึงจาก TCGdex (Pokémon) / optcgapi (One Piece) หรือทีมร้านเพิ่มเอง (source = 'manual')
-- ไม่เก็บราคาหรือมูลค่าการ์ดใด ๆ (กฎบริษัท) — สคริปต์ sync ตัดฟิลด์ราคาทิ้งก่อนบันทึก

create extension if not exists pg_trgm;

create table public.tcg_sets (
  id uuid primary key default gen_random_uuid(),
  game text not null,                         -- ค่าเดียวกับ lib/tcg.ts เช่น 'Pokémon', 'One Piece'
  lang text not null default 'en' check (lang in ('en', 'th', 'ja')),
  set_code text not null,                     -- เช่น 'sv01', 'SVDs', 'OP-01'
  name text not null,
  release_date date,
  card_count integer,
  logo_url text,
  source text not null check (source in ('tcgdex', 'optcgapi', 'manual')),
  updated_at timestamptz not null default now(),
  unique (game, lang, set_code)
);

create table public.tcg_cards (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  lang text not null default 'en' check (lang in ('en', 'th', 'ja')),
  set_code text not null,
  set_name text not null default '',
  card_number text not null,                  -- เลขที่พิมพ์บนการ์ด เช่น 'OP01-001', '001'
  variant text not null default 'normal',     -- normal / parallel / alt ฯลฯ
  name text not null,
  rarity text,
  card_type text,                             -- Leader / Character / Pokemon / Trainer ...
  color text,
  image_url text,
  attrs jsonb not null default '{}'::jsonb,   -- ข้อมูลเฉพาะเกม (cost, power, hp, ...) — ห้ามมีราคา
  source text not null check (source in ('tcgdex', 'optcgapi', 'manual')),
  source_id text not null,                    -- id ของผู้ให้ข้อมูล (manual = สุ่ม)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, lang, source_id)
);

create index tcg_cards_game_set_idx on public.tcg_cards (game, lang, set_code);
create index tcg_cards_number_idx on public.tcg_cards (card_number);
create index tcg_cards_name_trgm_idx on public.tcg_cards using gin (name gin_trgm_ops);

-- อ่านได้ทุกคน (รวมคนไม่ล็อกอิน) · ไม่มี policy เขียน = เขียนได้เฉพาะ service role (สคริปต์ sync / API แอดมิน)
alter table public.tcg_sets enable row level security;
alter table public.tcg_cards enable row level security;
create policy "Anyone can read tcg sets" on public.tcg_sets for select using (true);
create policy "Anyone can read tcg cards" on public.tcg_cards for select using (true);

-- ผูกการ์ดในคอลเลกชันกับฐานข้อมูล (ว่างได้: แถวเก่าที่พิมพ์ชื่อเองยังใช้ได้ตามเดิม)
alter table public.collection_cards
  add column if not exists card_id uuid references public.tcg_cards(id) on delete set null;
create index if not exists collection_cards_user_idx on public.collection_cards (user_id, created_at desc);
create index if not exists decks_user_idx on public.decks (user_id, updated_at desc);
