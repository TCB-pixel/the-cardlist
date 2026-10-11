-- บันทึกการใช้ Claude ของแต่ละข้อความ เพื่อสรุปค่าใช้จ่าย AI รายวัน
alter table public.chat_logs
  add column ai_model           text,
  add column input_tokens       integer,
  add column output_tokens      integer,
  add column cache_read_tokens  integer,
  add column cache_write_tokens integer,
  add column ai_cost_usd        numeric(10, 6);

comment on column public.chat_logs.ai_cost_usd is
  'ค่าใช้จ่าย Claude โดยประมาณ (USD) คำนวณจาก token × ราคาต่อโมเดลใน _shared/ai.ts — null = ไม่ได้เรียก AI หรือไม่รู้ราคาโมเดล';
