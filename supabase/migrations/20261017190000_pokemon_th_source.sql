-- แหล่งข้อมูลการ์ด Pokémon ภาษาไทยทางการ (asia.pokemon-card.com/th) — ได้รับอนุญาตจาก Pokémon ประเทศไทย 17 ต.ค. 2026
-- บันทึกอนุญาต: AI SMART/company-brain/permissions/2026-10-17_pokemon-th-card-data.md
-- เพิ่มค่า source = 'pokemon-th' เท่านั้น ไม่แตะข้อมูลเดิม

alter table public.tcg_cards drop constraint if exists tcg_cards_source_check;
alter table public.tcg_cards add constraint tcg_cards_source_check
  check (source in ('tcgdex', 'optcgapi', 'manual', 'pokemon-th'));

alter table public.tcg_sets drop constraint if exists tcg_sets_source_check;
alter table public.tcg_sets add constraint tcg_sets_source_check
  check (source in ('tcgdex', 'optcgapi', 'manual', 'pokemon-th'));
