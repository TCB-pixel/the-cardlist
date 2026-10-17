-- แหล่งข้อมูลการ์ด Eidolon TCG — ร้านเป็นหุ้นส่วน Eidolon ใช้ข้อมูลและภาพการ์ดได้ (เจ้าของยืนยัน 17 ต.ค. 2026, company-brain/eidolon-assets.md)
-- ข้อมูลมาจาก Google Sheet ที่เผยแพร่ซึ่งหน้า https://www.eidolontcg.com/card-list ใช้แสดงรายการการ์ด
-- เพิ่มค่า source = 'eidolon' เท่านั้น ไม่แตะข้อมูลเดิม

alter table public.tcg_cards drop constraint if exists tcg_cards_source_check;
alter table public.tcg_cards add constraint tcg_cards_source_check
  check (source in ('tcgdex', 'optcgapi', 'manual', 'pokemon-th', 'eidolon'));

alter table public.tcg_sets drop constraint if exists tcg_sets_source_check;
alter table public.tcg_sets add constraint tcg_sets_source_check
  check (source in ('tcgdex', 'optcgapi', 'manual', 'pokemon-th', 'eidolon'));
