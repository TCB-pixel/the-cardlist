-- Collection Tracker เฟส 2 (เจ้าของสั่งเริ่ม 17 ต.ค. 2026)
-- สถานะการ์ด (มี / อยากได้ / พร้อมแลก) · ภาษา · variant · วันออกเซตสำหรับเรียงผลค้นหา
-- เพิ่มคอลัมน์อย่างเดียว มีค่าเริ่มต้น — แถวเดิมกลายเป็น "มี" ภาษา "ไม่ระบุ" ไม่มีข้อมูลหาย

alter table public.collection_cards
  add column if not exists status text not null default 'own',
  add column if not exists language text not null default '',
  add column if not exists variant text not null default 'normal';

alter table public.collection_cards
  add constraint collection_cards_status_check check (status in ('own', 'want', 'trade')),
  add constraint collection_cards_language_check check (language in ('', 'th', 'en', 'ja')),
  add constraint collection_cards_quantity_check check (quantity between 1 and 9999);

-- วันออกเซตบนแถวการ์ด เพื่อให้ช่องค้นเรียงเซตใหม่ก่อน (สคริปต์ sync เติมให้ทุกครั้ง)
alter table public.tcg_cards add column if not exists release_date date;
update public.tcg_cards c
   set release_date = s.release_date
  from public.tcg_sets s
 where s.game = c.game and s.lang = c.lang and s.set_code = c.set_code
   and s.release_date is not null;
create index if not exists tcg_cards_release_idx on public.tcg_cards (game, release_date desc nulls last);
