-- Deck Builder เฟส 3: แชร์เด็คด้วยลิงก์ (เจ้าของสั่งเริ่ม 17 ต.ค. 2026)
-- ค่าเริ่มต้นเป็นส่วนตัว — ลูกค้าต้องกดเปิดเอง · หน้าแชร์ (/decks/<slug>) อ่านผ่าน server ด้วย service role
-- และเลือกเฉพาะคอลัมน์ของเด็ค (ไม่ส่ง user_id ออกไป) จึงไม่เพิ่ม policy ให้คนทั่วไปอ่านตาราง decks

alter table public.decks
  add column if not exists is_public boolean not null default false,
  add column if not exists share_slug text;

create unique index if not exists decks_share_slug_idx on public.decks (share_slug) where share_slug is not null;
