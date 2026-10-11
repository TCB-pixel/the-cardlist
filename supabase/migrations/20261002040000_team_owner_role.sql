-- เจ้าของบริษัทมีมากกว่า 1 คน: role 'owner' = ทำได้ทุกอย่าง ไม่ต้องลงเวลา ได้รับรายงานรายวัน
-- (OWNER_LINE_USER_ID ยังเป็นเจ้าของเสมอ ใช้ตั้งเจ้าของคนอื่นด้วยคำสั่ง "ตั้งเจ้าของ @ชื่อ")
alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members add constraint team_members_role_check
  check (role in ('owner', 'manager', 'hr', 'member'));
comment on column public.team_members.role is
  'owner = เจ้าของ (ทำได้ทุกอย่าง ไม่ต้องลงเวลา), manager = สั่งงาน/จัดกะ, hr = จัดกะ/ดูรายงาน, member = รับงาน ลงเวลา';
