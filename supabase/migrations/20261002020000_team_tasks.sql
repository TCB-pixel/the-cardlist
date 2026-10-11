-- ─────────────────────────────────────────────────────────────────────────────
-- บอทสั่งงานทีม (LINE OA "CARDLIST MANAGER" ในกลุ่มที่ทำงาน)
-- เก็บเฉพาะสมาชิกทีมและงาน — ไม่เก็บข้อความแชททั่วไปในกลุ่ม
-- RLS เปิดทุกตาราง ไม่มี policy → อ่าน/เขียนได้เฉพาะ service role
-- ─────────────────────────────────────────────────────────────────────────────

create table public.team_members (
  id            uuid primary key default gen_random_uuid(),
  line_user_id  text not null unique,
  nickname      text,
  display_name  text,
  role          text not null default 'member' check (role in ('manager', 'member')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
comment on column public.team_members.role is 'manager = สั่งงาน/ยกเลิกงานได้, member = รับงานและปิดงานของตัวเองได้';

create table public.tasks (
  id           bigint generated always as identity primary key, -- เลขสั้นๆ ใช้เรียกในแชท เช่น "เสร็จ #12"
  title        text not null,
  detail       text,
  assignee_id  uuid references public.team_members (id) on delete set null,
  created_by   uuid references public.team_members (id) on delete set null,
  due_at       timestamptz,
  status       text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  reminded_at  timestamptz,
  done_at      timestamptz,
  done_by      uuid references public.team_members (id) on delete set null,
  created_at   timestamptz not null default now()
);
comment on column public.tasks.reminded_at is 'เวลาที่ส่งเตือนล่วงหน้า 1 ชม. ไปแล้ว (null = ยังไม่เตือน) — แก้ due_at แล้วควรล้างค่านี้';

create index tasks_open_due_idx on public.tasks (due_at) where status = 'open';

alter table public.team_members enable row level security;
alter table public.tasks        enable row level security;
revoke all on public.team_members, public.tasks from anon, authenticated;

-- ตั้งเวลา: เตือนงานใกล้ครบกำหนดทุก 15 นาที + สรุปงานทีม 9:00 น. (02:00 UTC)
-- ใช้รหัสลับตัวเดียวกับสรุปแชทลูกค้า (chatbot_cron_secret ใน Vault)
select cron.schedule(
  'team-task-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://mkexidyjjnasyyeqcsvf.supabase.co/functions/v1/team-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'chatbot_cron_secret')
    ),
    body := '{"job":"remind"}'::jsonb
  );
  $$
);

select cron.schedule(
  'team-morning-summary',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://mkexidyjjnasyyeqcsvf.supabase.co/functions/v1/team-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'chatbot_cron_secret')
    ),
    body := '{"job":"morning"}'::jsonb
  );
  $$
);
