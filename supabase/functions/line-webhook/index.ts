// Webhook ของ LINE OA — รับข้อความลูกค้า, ให้ AI ตอบ หรือส่งให้เจ้าของอนุมัติ
//
// 1. ตรวจ x-line-signature ทุกครั้ง ไม่ผ่าน = 401
// 2. ตอบ 200 ให้ LINE ทันที แล้วค่อยประมวลผลต่อเบื้องหลังใน handler.ts
//
// LINE รอคำตอบแค่ไม่กี่วินาที ไฟล์นี้จึง import แค่ line.ts (ไม่มี dependency)
// ส่วน Claude SDK / supabase-js ที่โหลดช้าตอน cold start จะถูกโหลดหลังตอบ LINE ไปแล้ว
import { verifySignature } from "../_shared/line.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const body = await req.text();
  if (!(await verifySignature(body, req.headers.get("x-line-signature")))) {
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
