import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

// ส่งอีเมลทดสอบผ่าน Resend ด้วย key และผู้ส่งเดียวกับที่ระบบออเดอร์ใช้จริง
// ไว้ตรวจว่าโดเมนยืนยันแล้ว / key ใช้ได้ / อีเมลถึงจริง โดยไม่ต้องรอออเดอร์จริง
//
// กันถูกใช้ส่งสแปม: ส่งได้เฉพาะอีเมลที่อยู่ในรายชื่อแอดมิน/ทีมงานเท่านั้น
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "orders:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { to } = await req.json();
    const target = String(to ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
    }

    const [{ data: admins }, { data: staff }] = await Promise.all([
      adminDb.from("admin_users").select("email"),
      adminDb.from("admin_staff").select("email"),
    ]);
    const allowed = new Set(
      [...(admins ?? []), ...(staff ?? [])].map((r: any) => String(r.email ?? "").toLowerCase())
    );
    if (!allowed.has(target)) {
      return NextResponse.json(
        { error: "ส่งทดสอบได้เฉพาะอีเมลของแอดมิน/ทีมงานในระบบเท่านั้น" },
        { status: 403 }
      );
    }

    const key = process.env.RESEND_API_KEY;
    if (!key) return NextResponse.json({ ok: false, step: "key", error: "ไม่ได้ตั้งค่า RESEND_API_KEY ใน Vercel" });

    const from = process.env.ORDER_EMAIL_FROM ?? "The Cardlist <orders@thecardlistbkk.com>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [target],
        subject: "ทดสอบระบบอีเมล • The Cardlist",
        html:
          `<div style="font-family:Arial,sans-serif;max-width:480px">` +
          `<h2 style="margin:0 0 8px">✅ ระบบอีเมลทำงานปกติ</h2>` +
          `<p style="color:#52525b">อีเมลฉบับนี้ส่งจากระบบสั่งซื้อของ The Cardlist เพื่อทดสอบการตั้งค่า ` +
          `ถ้าคุณเห็นข้อความนี้ แปลว่าอีเมลยืนยันคำสั่งซื้อและแจ้งออเดอร์ใหม่จะส่งถึงได้</p>` +
          `<p style="color:#a1a1aa;font-size:12px">ผู้ส่ง: ${from.replace(/</g, "&lt;")}</p></div>`,
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      let detail = body.slice(0, 300);
      try { detail = JSON.parse(body).message ?? detail; } catch { /* ใช้ข้อความดิบ */ }
      return NextResponse.json({ ok: false, step: "send", status: res.status, from, error: detail });
    }

    let id: string | null = null;
    try { id = JSON.parse(body).id ?? null; } catch { /* ไม่มี id ก็ไม่เป็นไร */ }
    return NextResponse.json({ ok: true, from, to: target, id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
