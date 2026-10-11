-- โหมดผู้ช่วย AI ส่วนตัว (เจ้าของคุยกับบอทได้ทุกเรื่อง) — เก็บบทสนทนาไว้ให้ AI จำได้ + ค่าใช้จ่าย AI
create table if not exists public.assistant_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  line_user_id text not null,
  bot text not null check (bot in ('customer', 'team')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  cleared boolean not null default false, -- พิมพ์ "เริ่มใหม่" = ไม่ส่งให้ AI อีก (ไม่ลบ)
  ai_model text,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_write_tokens int,
  web_searches int,
  ai_cost_usd numeric
);
create index if not exists assistant_messages_user_idx on public.assistant_messages (line_user_id, created_at desc);

alter table public.assistant_messages enable row level security;
-- ไม่มี policy = เข้าถึงได้เฉพาะ service role (Edge Function)
