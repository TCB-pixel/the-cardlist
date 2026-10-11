-- ─────────────────────────────────────────────────────────────────────────────
-- HR รอบ 1 ของบอททีม: บทบาท HR, ตารางกะ, ลงเวลาเข้า-ออก, แจ้งขาด/สาย, รายงานรายวัน
-- กะปกติ (11:00–22:00 ทุกวัน) และเกณฑ์สาย (30 นาที) อยู่ในโค้ด _shared/hr.ts
-- ตาราง shifts เก็บเฉพาะวันที่ต่างจากกะปกติ (เปลี่ยนเวลา / วันหยุด)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members add constraint team_members_role_check
  check (role in ('manager', 'hr', 'member'));
comment on column public.team_members.role is
  'manager = สั่งงาน/จัดกะ, hr = จัดกะ/ดูรายงาน, member = รับงาน ลงเวลา';

alter table public.team_members
  add column tracks_attendance boolean not null default true;
comment on column public.team_members.tracks_attendance is
  'false = ไม่ต้องลงเวลา ไม่เตือน ไม่อยู่ในรายงานเวลา (เช่น เจ้าของร้าน)';

create table public.shifts (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.team_members (id) on delete cascade,
  work_date   date not null,
  start_time  time,
  end_time    time,
  is_off      boolean not null default false,
  note        text,
  created_at  timestamptz not null default now(),
  unique (member_id, work_date)
);
comment on table public.shifts is 'กะที่ต่างจากกะปกติเท่านั้น — วันที่ไม่มีแถว = กะปกติ';

create table public.attendance (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references public.team_members (id) on delete cascade,
  work_date          date not null,
  check_in           timestamptz,
  check_out          timestamptz,
  late_minutes       integer not null default 0,
  missing_alerted_at timestamptz,
  created_at         timestamptz not null default now(),
  unique (member_id, work_date)
);
comment on column public.attendance.late_minutes is 'นาทีที่เข้าช้ากว่าเวลาเริ่มกะ (0 = ตรงเวลา) — นับว่า "สาย" เมื่อเกินเกณฑ์ใน hr.ts';

create table public.absence_notices (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.team_members (id) on delete cascade,
  work_date   date not null,
  kind        text not null check (kind in ('late', 'absent', 'sick')),
  minutes     integer,
  reason      text,
  created_at  timestamptz not null default now()
);
create index absence_notices_date_idx on public.absence_notices (work_date);

alter table public.shifts          enable row level security;
alter table public.attendance      enable row level security;
alter table public.absence_notices enable row level security;
revoke all on public.shifts, public.attendance, public.absence_notices from anon, authenticated;

-- รายงานรายวัน 22:30 น. เวลาไทย (15:30 UTC) → Google Sheets + LINE ส่วนตัวหัวหน้า/HR
select cron.schedule(
  'team-daily-report',
  '30 15 * * *',
  $$
  select net.http_post(
    url := 'https://mkexidyjjnasyyeqcsvf.supabase.co/functions/v1/team-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'chatbot_cron_secret')
    ),
    body := '{"job":"report"}'::jsonb
  );
  $$
);
