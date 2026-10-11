# LINE bots + Loyverse (Supabase) — สรุปสำหรับคนทำต่อ

Supabase project: `mkexidyjjnasyyeqcsvf` · Edge Functions อยู่ใน `supabase/functions/` · migrations ใน `supabase/migrations/`
deploy ผ่าน Supabase MCP `deploy_edge_function` (ต้องส่งทุกไฟล์ที่ฟังก์ชัน import รวม `_shared/*`) · `verify_jwt = false` ทุกตัว (ตรวจสิทธิ์เอง)

## ⚠️ ก่อน deploy / ตั้ง cron ทุกครั้ง
ใน Supabase มีของที่ **ไม่อยู่ใน repo นี้**: ฟังก์ชัน `loyverse-daily-report`, schema `loyverse` (mirror ข้อมูล POS),
cron `loyverse-daily-report`, vault secret `loyverse_cron_secret`. `deploy_edge_function` และ `cron.schedule` จะ **เขียนทับชื่อซ้ำเงียบๆ**
→ เช็ก `list_edge_functions` และ `select * from cron.job` ก่อนเสมอ

## ฟังก์ชัน
| ฟังก์ชัน | หน้าที่ | ตรวจสิทธิ์ |
|---|---|---|
| `line-webhook` | บอทลูกค้า OA "The Cardlist": AI ตอบจาก `knowledge` + `products`, คำถามเสี่ยง → การ์ดอนุมัติหาเจ้าของ (`pending_approvals`), เจ้าของแชท = ผู้ช่วย AI ส่วนตัว | x-line-signature (`LINE_CHANNEL_SECRET`) |
| `team-bot` | บอททีม OA "CARDLIST MANAGER" ในกลุ่มงาน + แชทส่วนตัว: สั่งงาน (`tasks`), กะ (`shifts`), แจ้งสาย/ลา, ผู้ช่วย AI ของเจ้าของ | x-line-signature (`TEAM_LINE_CHANNEL_SECRET`) |
| `team-jobs` | cron: เตือนงาน (*/15), สรุปเช้า 9:00, รายงานรายวัน 22:30 → Google Sheets + LINE เจ้าของ, รายสัปดาห์ จันทร์ 9:00 | vault `chatbot_cron_secret` |
| `daily-summary` | cron 9:00 สรุปแชทลูกค้า + ค่า AI เมื่อวาน (รวมผู้ช่วย AI) | vault `chatbot_cron_secret` |
| `loyverse-sync` | cron */10 mirror Loyverse ทั้งหมด → schema `loyverse` ผ่าน `loyverse.ingest_*` (ใช้ `SUPABASE_DB_URL`) — ใช้โดย loyverse-daily-report | vault `loyverse_cron_secret` |
| `loyverse-web-sync` | cron */15 สต็อก Loyverse → `products.stock` (เว็บเป็นตัวหลัก: ไม่แก้ราคา/ไม่สร้างสินค้า) + หักยอดขายเว็บใน Loyverse; ตั้งค่าใน `loyverse_settings`, ผลใน `loyverse_sync_runs`; สั่งทันทีได้ด้วย `select loyverse_sync_now(dry_run)` | vault `chatbot_cron_secret` |

`_shared/assistant.ts` = ผู้ช่วย AI (Sonnet 5.5 + web search) ใช้ได้เฉพาะ `OWNER_LINE_USER_ID` / `ASSISTANT_LINE_USER_IDS`, จำบทสนทนาใน `assistant_messages`

## Secrets (ชื่อเท่านั้น — ค่าอยู่ใน Supabase Edge Function secrets)
`ANTHROPIC_API_KEY`, `CLAUDE_MODEL` (ไม่ตั้ง = claude-sonnet-5-5), `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `OWNER_LINE_USER_ID`,
`TEAM_LINE_CHANNEL_SECRET`, `TEAM_LINE_CHANNEL_ACCESS_TOKEN`, `TEAM_GROUP_ID`, `TEAM_ATTENDANCE` (ปิดอยู่), `LOYVERSE_TOKEN`,
`GOOGLE_SERVICE_ACCOUNT_JSON` + `TEAM_REPORT_SHEET_ID` (ยังไม่ได้ตั้ง)

## ค้างอยู่
- ข้อมูลร้านใน `knowledge` ยังมีตัวอย่างที่แต่งขึ้น 6 รายการ (ชื่อลงท้าย "(ตัวอย่าง)") — รอข้อมูลจริงจากเจ้าของ
- หน้าแอดมิน `app/admin/chatbot/*` + API ยังไม่ได้ deploy ขึ้นเว็บ; ยังไม่มีหน้าแอดมินดูผลซิงก์ Loyverse / งานทีม
- Google Sheets รายงานทีม รอเจ้าของตั้ง secret
- หักสต็อก Loyverse จากออเดอร์เว็บ ยังไม่เคยทดสอบกับออเดอร์จริง
- OA ทีมใช้แพ็กเกจฟรี 300 ข้อความ/เดือน — push ทุกครั้งนับโควตา
