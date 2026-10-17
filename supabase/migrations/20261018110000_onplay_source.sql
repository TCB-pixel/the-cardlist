-- แหล่งข้อมูลการ์ด OnPlay Arena (https://arena.onplay.in.th/cards/) — 6 เกม: Duel Masters, Haikyu!!, Detective Conan,
-- WIXOSS, Horo-Beat, Nijinana · เจ้าของสั่งดึงข้อมูล 18 ต.ค. 2026 ("ตามที่ robots.txt อนุญาต") · robots.txt อนุญาตทั้งหมด
-- และไม่พบหน้าเงื่อนไขการใช้งาน ณ วันที่ดึง · เพิ่มค่า source = 'onplay' เท่านั้น ไม่แตะข้อมูลเดิม

alter table public.tcg_cards drop constraint if exists tcg_cards_source_check;
alter table public.tcg_cards add constraint tcg_cards_source_check
  check (source in ('tcgdex', 'optcgapi', 'manual', 'pokemon-th', 'eidolon', 'onplay'));

alter table public.tcg_sets drop constraint if exists tcg_sets_source_check;
alter table public.tcg_sets add constraint tcg_sets_source_check
  check (source in ('tcgdex', 'optcgapi', 'manual', 'pokemon-th', 'eidolon', 'onplay'));
