// Webhook ของ LINE OA ทีม ("CARDLIST MANAGER") — สั่งงานในกลุ่มที่ทำงาน
// แบบเดียวกับ line-webhook: ตรวจลายเซ็น → ตอบ LINE ทันที → ทำงานจริงเบื้องหลังใน handler.ts
// import แค่ line.ts (ไม่มี dependency) ให้ตอบ LINE ทันแม้ cold start — team.ts ดึง supabase-js มาด้วยจึงโหลดทีหลัง
import { verifySignatureWith } from "../_shared/line.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const body = await req.text();
  if (!(await verifySignatureWith(Deno.env.get("TEAM_LINE_CHANNEL_SECRET"), body, req.headers.get("x-line-signature")))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const events = JSON.parse(body).events ?? [];
  if (events.length > 0) {
    EdgeRuntime.waitUntil(
      import("./handler.ts").then((m) => m.handleEvents(events)).catch((err) => console.error("handler failed", err)),
    );
  }
  return new Response("OK");
});
