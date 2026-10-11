-- ─────────────────────────────────────────────────────────────────────────────
-- LINE Chatbot: ข้อมูลร้านให้ AI ใช้ตอบ, ประวัติแชท, รายการรออนุมัติ, สรุปรายวัน
--
-- ทุกตารางเปิด RLS และไม่มี policy ให้ anon/authenticated เลย
-- → อ่าน/เขียนได้เฉพาะ service role (Edge Function และ /api/admin ของเว็บ)
-- ─────────────────────────────────────────────────────────────────────────────

-- ข้อมูลร้าน (knowledge) ─────────────────────────────────────────────────────
create table public.knowledge (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null check (category in ('งานแข่ง', 'สินค้า', 'ร้าน', 'กติกา')),
  content     text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.knowledge is 'ข้อมูลร้านที่บอท LINE ใช้ตอบลูกค้า (active = false คือซ่อนจาก AI)';

create or replace function public.knowledge_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger knowledge_touch_updated_at
  before update on public.knowledge
  for each row execute function public.knowledge_touch_updated_at();

-- ประวัติแชท ────────────────────────────────────────────────────────────────
create table public.chat_logs (
  id                uuid primary key default gen_random_uuid(),
  line_user_id      text not null,
  display_name      text,
  message           text not null,
  reply             text,
  replied_by        text not null check (replied_by in ('ai', 'admin', 'pending')),
  escalation_reason text,
  missing_info      text,
  webhook_event_id  text unique,
  created_at        timestamptz not null default now()
);
comment on column public.chat_logs.replied_by is 'ai = AI ตอบเอง, pending = ส่งให้แอดมิน (ยังไม่ตอบ), admin = แอดมินตอบแล้ว';
comment on column public.chat_logs.missing_info is 'หัวข้อที่ลูกค้าถามแต่ไม่มีในตาราง knowledge — ใช้ทำสรุปรายวัน';
comment on column public.chat_logs.webhook_event_id is 'กัน LINE ส่ง event ซ้ำ (redelivery) แล้วบอทตอบสองรอบ';

create index chat_logs_created_at_idx on public.chat_logs (created_at desc);
create index chat_logs_line_user_id_idx on public.chat_logs (line_user_id, created_at desc);

-- รายการรออนุมัติ ───────────────────────────────────────────────────────────
create table public.pending_approvals (
  id            uuid primary key default gen_random_uuid(),
  chat_log_id   uuid references public.chat_logs (id) on delete set null,
  line_user_id  text not null,
  display_name  text,
  question      text not null,
  draft_answer  text not null,
  reason        text,
  status        text not null default 'pending'
                check (status in ('pending', 'awaiting_owner_reply', 'sent', 'dismissed')),
  final_answer  text,
  handled_by    text,
  created_at    timestamptz not null default now(),
  handled_at    timestamptz
);
comment on column public.pending_approvals.status is
  'pending = รอเจ้าของกด, awaiting_owner_reply = กด "ตอบเอง" แล้วรอพิมพ์คำตอบ, sent = ส่งให้ลูกค้าแล้ว, dismissed = ไม่ต้องตอบ';

create index pending_approvals_status_idx on public.pending_approvals (status, created_at desc);

-- RLS ───────────────────────────────────────────────────────────────────────
alter table public.knowledge         enable row level security;
alter table public.chat_logs         enable row level security;
alter table public.pending_approvals enable row level security;

revoke all on public.knowledge, public.chat_logs, public.pending_approvals from anon, authenticated;

-- สรุปรายวัน 9:00 น. (เวลาไทย = 02:00 UTC) ─────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- รหัสลับสำหรับให้ cron เรียก Edge Function ได้คนเดียว — สุ่มเก็บใน Vault ไม่มีใครต้องคัดลอก
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'chatbot_cron_secret');

-- Edge Function ใช้เช็คว่ารหัสที่ส่งมาตรงกับใน Vault ไหม (เรียกได้เฉพาะ service role)
create or replace function public.chatbot_verify_cron_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'chatbot_cron_secret' and decrypted_secret = p_secret
  );
$$;
revoke all on function public.chatbot_verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.chatbot_verify_cron_secret(text) to service_role;

select cron.schedule(
  'chatbot-daily-summary',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://mkexidyjjnasyyeqcsvf.supabase.co/functions/v1/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'chatbot_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ข้อมูลตัวอย่าง (แก้/ลบได้ที่ /admin/chatbot/knowledge) ─────────────────────
insert into public.knowledge (title, category, content) values
('เวลาเปิด-ปิดร้าน (ตัวอย่าง)', 'ร้าน',
 'ร้านเปิดทุกวัน 12:00–21:00 น. ปิดทุกวันจันทร์ วันหยุดนักขัตฤกษ์เปิดตามปกติ ยกเว้นมีประกาศในเพจ'),
('ที่ตั้งร้านและการเดินทาง (ตัวอย่าง)', 'ร้าน',
 'ร้าน The Cardlist อยู่กรุงเทพฯ ดูแผนที่ได้ที่เว็บไซต์ thecardlistbkk.com มีที่จอดรถสำหรับลูกค้า'),
('ช่องทางชำระเงิน (ตัวอย่าง)', 'ร้าน',
 'รับชำระผ่าน PromptPay, โอนธนาคาร, บัตรเครดิต (ผ่านหน้าเว็บ) และเงินสดที่หน้าร้าน การยืนยันการโอนต้องรอแอดมินตรวจสลิป'),
('การจัดส่งสินค้า (ตัวอย่าง)', 'สินค้า',
 'สั่งซื้อผ่านเว็บไซต์ thecardlistbkk.com จัดส่งด้วย Kerry ภายใน 1–2 วันทำการหลังชำระเงิน ได้เลขพัสดุทาง LINE และอีเมล'),
('สินค้าที่ร้านขาย (ตัวอย่าง)', 'สินค้า',
 'ร้านมีการ์ด One Piece Card Game, Pokémon TCG และ Disney Lorcana ทั้งแบบกล่อง ซอง และการ์ดซิงเกิล ราคาและสต็อกล่าสุดดูได้ที่หน้า Shop บนเว็บไซต์ ราคาตามหน้าเว็บเป็นราคาสุทธิ'),
('งานแข่งประจำสัปดาห์ (ตัวอย่าง)', 'งานแข่ง',
 'มีงานแข่ง One Piece ทุกวันเสาร์ 14:00 น. และ Pokémon ทุกวันอาทิตย์ 14:00 น. ค่าสมัคร 150 บาท รับ 32 คน ลงทะเบียนล่วงหน้าที่เมนูอีเวนต์บนเว็บไซต์ แจกซองรางวัลตามอันดับ'),
('กติกาการแข่งขัน (ตัวอย่าง)', 'กติกา',
 'แข่งระบบ Swiss แบบ Best of 1 รอบละ 35 นาที ใช้เด็คตามฟอร์แมต Standard ล่าสุดของแต่ละเกม ต้องมาเช็คอินก่อนเริ่ม 15 นาที ถ้ามาสายเกิน 10 นาทีหลังเริ่มรอบแรกถือว่าสละสิทธิ์'),
('ระบบสมาชิกและแต้มสะสม (ตัวอย่าง)', 'ร้าน',
 'สมัครสมาชิกฟรีที่เว็บไซต์และผูกบัญชี LINE ได้ ทุกครั้งที่มาเล่นที่ร้านสแกน QR เพื่อสะสมรอบเล่น ครบตามจำนวนรับของรางวัล ระดับสมาชิกมี Bronze, Silver, Gold, Platinum');
