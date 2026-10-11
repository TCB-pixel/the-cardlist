import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

// ---------- GET : รายการรออนุมัติ (+ ที่จัดการแล้ว 50 รายการล่าสุด) ----------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, "chatbot:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [open, done] = await Promise.all([
    adminDb.from("pending_approvals").select("*")
      .in("status", ["pending", "awaiting_owner_reply"])
      .order("created_at", { ascending: true }),
    adminDb.from("pending_approvals").select("*")
      .in("status", ["sent", "dismissed"])
      .order("handled_at", { ascending: false })
      .limit(50),
  ]);
  if (open.error || done.error) {
    return NextResponse.json({ error: (open.error ?? done.error)!.message }, { status: 500 });
  }
  return NextResponse.json({ open: open.data, done: done.data });
}

// ---------- POST : อนุมัติ/แก้แล้วส่งให้ลูกค้า (push — นับโควตา LINE) ----------
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, "chatbot:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, answer } = await req.json();
  const text = String(answer ?? "").trim();
  if (!id || !text) return NextResponse.json({ error: "กรอกคำตอบก่อนส่ง" }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "คำตอบยาวเกิน 5,000 ตัวอักษร" }, { status: 400 });

  // จองรายการก่อนส่ง — ถ้ามีคนกดอนุมัติไปแล้ว (เว็บหรือ LINE) จะไม่ส่งซ้ำ
  const { data: item } = await adminDb
    .from("pending_approvals")
    .update({ status: "sent", final_answer: text, handled_by: auth.caller.email, handled_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "awaiting_owner_reply"])
    .select("line_user_id, chat_log_id")
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "รายการนี้ถูกจัดการไปแล้ว" }, { status: 409 });

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ to: item.line_user_id, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) {
    await adminDb.from("pending_approvals")
      .update({ status: "pending", final_answer: null, handled_by: null, handled_at: null })
      .eq("id", id);
    return NextResponse.json({ error: `ส่ง LINE ไม่สำเร็จ (${res.status})` }, { status: 502 });
  }

  if (item.chat_log_id) {
    await adminDb.from("chat_logs").update({ reply: text, replied_by: "admin" }).eq("id", item.chat_log_id);
  }
  return NextResponse.json({ ok: true });
}

// ---------- PATCH : ไม่ต้องตอบ (เช่น ตอบใน LINE OA Manager ไปแล้ว) ----------
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, "chatbot:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ไม่มี id" }, { status: 400 });

  const { error } = await adminDb
    .from("pending_approvals")
    .update({ status: "dismissed", handled_by: auth.caller.email, handled_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "awaiting_owner_reply"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
