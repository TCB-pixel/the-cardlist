-- =============================================
-- THE CARDLIST — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES (extends Supabase auth.users) ──
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  tier text not null default 'bronze' check (tier in ('bronze','silver','gold','platinum')),
  points integer not null default 0,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── PRODUCTS ──
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price numeric(10,2) not null,
  stock integer not null default 0,
  category text not null check (category in ('sealed','single','preorder','accessory')),
  tcg text not null check (tcg in ('onepiece','pokemon','mtg','dragonball')),
  rarity text,
  badge text,
  image_url text,
  created_at timestamptz default now()
);
alter table public.products enable row level security;
create policy "Products are viewable by everyone" on public.products for select using (true);

-- ── EVENTS ──
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  location text not null,
  date date not null,
  time time not null,
  max_slots integer not null default 32,
  booked_slots integer not null default 0,
  tcg text not null,
  format text,
  image_url text,
  created_at timestamptz default now()
);
alter table public.events enable row level security;
create policy "Events are viewable by everyone" on public.events for select using (true);

-- ── BOOKINGS ──
create table public.bookings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  qr_code text unique default uuid_generate_v4()::text,
  created_at timestamptz default now(),
  unique(user_id, event_id)
);
alter table public.bookings enable row level security;
create policy "Users can view own bookings" on public.bookings for select using (auth.uid() = user_id);
create policy "Users can insert own bookings" on public.bookings for insert with check (auth.uid() = user_id);
create policy "Users can update own bookings" on public.bookings for update using (auth.uid() = user_id);

-- Auto-increment booked_slots on booking
create or replace function public.increment_booked_slots()
returns trigger language plpgsql as $$
begin
  update public.events set booked_slots = booked_slots + 1 where id = new.event_id;
  return new;
end;
$$;
create trigger on_booking_created
  after insert on public.bookings
  for each row execute procedure public.increment_booked_slots();

-- ── NEWS / BLOG ──
create table public.news (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  slug text unique not null,
  content text not null,
  excerpt text,
  tag text not null default 'NEWS',
  image_url text,
  published_at timestamptz default now()
);
alter table public.news enable row level security;
create policy "News is viewable by everyone" on public.news for select using (true);

-- ── ORDERS ──
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  total numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','paid','shipped','completed','cancelled')),
  created_at timestamptz default now()
);
alter table public.orders enable row level security;
create policy "Users can view own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Users can insert own orders" on public.orders for insert with check (auth.uid() = user_id);

-- ── ORDER ITEMS ──
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null default 1,
  price numeric(10,2) not null
);
alter table public.order_items enable row level security;
create policy "Users can view own order items" on public.order_items
  for select using (
    exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
  );

-- ── SAMPLE DATA ──
insert into public.products (name, description, price, stock, category, tcg, badge) values
  ('Booster Box OP-10', 'One Piece TCG Booster Box OP-10 Manga', 3200, 20, 'preorder', 'onepiece', 'PRE-ORDER'),
  ('Monkey D. Luffy SEC', 'One Piece OP-01 Secret Rare', 4200, 2, 'single', 'onepiece', 'HOT'),
  ('Booster Box SV8a', 'Pokémon TCG Booster Box SV8a', 2800, 15, 'sealed', 'pokemon', 'NEW'),
  ('Charizard ex SAR', 'Pokémon 151 Super Rare', 1850, 3, 'single', 'pokemon', 'HOT'),
  ('Oko, Thief of Crowns Foil', 'MTG Eldraine Foil', 4500, 4, 'single', 'mtg', 'NEW'),
  ('Son Goku SPR', 'Dragon Ball Super Card Game SPR', 890, 8, 'single', 'dragonball', null);

insert into public.events (title, description, location, date, time, max_slots, tcg, format) values
  ('OP Regional Bangkok', 'One Piece TCG Regional Tournament', 'สยามพารากอน Hall A', '2026-04-26', '09:00', 128, 'One Piece', 'Swiss Format'),
  ('Pokémon League Cup', 'In-Store Pokémon League Cup', 'The Cardlist Store', '2026-05-03', '13:00', 32, 'Pokémon', 'Bo3'),
  ('MTG Commander Night', 'Weekly Commander Format Night', 'The Cardlist Store', '2026-05-10', '18:00', 16, 'MTG', 'Commander');

insert into public.news (title, slug, content, excerpt, tag) values
  ('Decklist แชมป์ OP Regional Bangkok 2026', 'decklist-op-regional-bkk-2026', 'เนื้อหาบทความ...', 'ส่องเด็คของแชมป์งาน OP Regional Bangkok 2026', 'TOURNAMENT'),
  ('กำหนดการวางจำหน่าย Q2 2026 ทุกเกม', 'release-schedule-q2-2026', 'เนื้อหาบทความ...', 'ปฏิทินวางจำหน่ายสินค้าใหม่ Q2 2026', 'RELEASE');

-- =============================================
-- ADMIN USERS & RBAC
-- =============================================

create table public.admin_users (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null,
  role text not null default 'staff' check (role in ('owner','head_staff','staff')),
  active boolean not null default true,
  created_at timestamptz default now(),
  last_login timestamptz
);
alter table public.admin_users enable row level security;

-- Only admin users can read admin_users table
create policy "Admin users can view admin list"
  on public.admin_users for select
  using (exists (select 1 from public.admin_users where id = auth.uid() and active = true));

-- Only owner/head_staff can insert
create policy "Owner and head_staff can add staff"
  on public.admin_users for insert
  with check (exists (
    select 1 from public.admin_users
    where id = auth.uid() and role in ('owner','head_staff') and active = true
  ));

-- Owner can update anyone, head_staff can only update staff
create policy "Role-based update"
  on public.admin_users for update
  using (exists (
    select 1 from public.admin_users au
    where au.id = auth.uid() and au.active = true
    and (
      au.role = 'owner'
      or (au.role = 'head_staff' and (select role from public.admin_users where id = admin_users.id) = 'staff')
    )
  ));

-- Only owner can delete
create policy "Only owner can delete admin"
  on public.admin_users for delete
  using (exists (
    select 1 from public.admin_users where id = auth.uid() and role = 'owner' and active = true
  ));

-- Update last_login on sign in
create or replace function public.handle_admin_login()
returns trigger language plpgsql security definer as $$
begin
  update public.admin_users set last_login = now() where id = new.id;
  return new;
end;
$$;

-- Sample admin users (passwords set via Supabase Auth dashboard)
-- insert into public.admin_users (id, name, email, role) values
--   ('<uuid-from-auth>', 'Owner Name', 'owner@thecardlist.com', 'owner'),
--   ('<uuid-from-auth>', 'Head Staff Name', 'head@thecardlist.com', 'head_staff');

-- =============================================
-- SETUP OWNER ACCOUNT
-- =============================================
-- หลังจาก Kritanat สมัครบัญชีผ่าน Supabase Auth แล้ว
-- ให้รัน SQL นี้เพื่อให้สิทธิ์ Owner:

-- INSERT INTO public.admin_users (id, name, email, role)
-- SELECT id, 'Kritanat Sukhaneskul', 'thecardlistbkk@gmail.com', 'owner'
-- FROM auth.users
-- WHERE email = 'thecardlistbkk@gmail.com';

-- =============================================
-- ARTIST CARDS — การ์ดศิลปินไทย (หน้า /thaiartistcards)
-- =============================================

-- หมวดหมู่การ์ด (แอดมินสร้าง/ลบเองได้จากหน้า /admin/artists)
create table if not exists public.artist_categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text not null unique,
  "order" integer not null default 1,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table public.artist_categories enable row level security;
create policy "Artist categories are viewable by everyone"
  on public.artist_categories for select using (true);

-- ศิลปินแต่ละคน
create table if not exists public.artists (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text not null unique,
  bio text,
  avatar_url text,
  instagram_url text,
  facebook_url text,
  x_url text,
  "order" integer not null default 1,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table public.artists enable row level security;
create policy "Artists are viewable by everyone"
  on public.artists for select using (true);

-- การ์ดของศิลปินแต่ละใบ
create table if not exists public.artist_cards (
  id uuid default uuid_generate_v4() primary key,
  artist_id uuid not null references public.artists(id) on delete cascade,
  category_id uuid references public.artist_categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  rarity text,
  limited_count integer,
  collection text,
  release_year integer,
  "order" integer not null default 1,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table public.artist_cards enable row level security;
create policy "Artist cards are viewable by everyone"
  on public.artist_cards for select using (true);

create index if not exists artist_cards_artist_id_idx on public.artist_cards(artist_id);
create index if not exists artist_cards_category_id_idx on public.artist_cards(category_id);

-- หมายเหตุ: ไม่มี policy สำหรับ insert/update/delete โดยตั้งใจ
-- การเขียนข้อมูลทำผ่าน /api/admin/* ที่ใช้ service role key ฝั่ง server เท่านั้น
