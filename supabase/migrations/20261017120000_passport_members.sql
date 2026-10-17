-- CARDLIST PASSPORT — สมัครสมาชิกด้วย LINE ก่อนใช้ (เจ้าของสั่ง 17 ต.ค. 2026)
-- ตารางใหม่เท่านั้น ไม่แก้ profiles · RLS ไม่มี policy = เข้าถึงผ่าน API ฝั่ง server เท่านั้น

-- ข้อมูลสมาชิก Passport (เก็บน้อยที่สุด): ชื่อเล่น · ช่วงอายุ · เกมที่เล่น (ไม่บังคับ)
create table public.passport_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  age_range text not null check (age_range in ('under10', '10-14', '15-19', '20-29', '30-39', '40+')),
  games text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- บันทึกความยินยอม (เพิ่มแถวอย่างเดียว ไม่แก้ของเดิม — แถวล่าสุดของแต่ละ purpose คือสถานะปัจจุบัน)
-- purpose 'passport' = ใช้ข้อมูลเพื่อระบบ Passport (บังคับ) · 'marketing' = รับข่าวสาร/โปรโมชัน (ไม่บังคับ)
create table public.member_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('passport', 'marketing')),
  granted boolean not null,
  version text not null,
  guardian boolean not null default false,
  source text not null default 'passport_join',
  created_at timestamptz not null default now()
);
create index member_consents_user_idx on public.member_consents(user_id, purpose, created_at desc);

-- 1 บัญชีถือการ์ด Passport ได้ 1 ใบ และพาสปอร์ตฟรี (Learn To Play) ได้ 1 อัน ต่อชุดจริง/ทดสอบ
create unique index passports_one_per_user on public.passports(user_id, kind, is_test) where user_id is not null;

alter table public.passport_members enable row level security;
alter table public.member_consents enable row level security;
