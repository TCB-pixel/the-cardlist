import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/announce
// รับ { to: string[]  (line_user_id), text: string }  →  ยิง LINE multicast เป็น batch ละ 500
// ตรวจสิทธิ์ admin เหมือน route อื่น ๆ  (ปรับ requireAdmin ให้ใช้ helper เดิมของคุณได้)
// ENV ที่ต้องมี: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LINE_CHANNEL_ACCESS_TOKEN
// ─────────────────────────────────────────────────────────────────────────────

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const MULTICAST_URL = "https://api.line.me/v2/bot/message/multicast";
const BATCH = 500;          // LINE: สูงสุด 500 user id ต่อ request
const MAX_TEXT = 5000;      // LINE: ข้อความ text ยาวสุด 5000 ตัวอักษร

// ── ตรวจสิทธิ์ทีมงาน — แนะนำให้สลับมาใช้ helper เดียวกับ /api/admin/tickets ──
async function requireAdmin(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { ok: false as const, status: 401, error: "unauthorized" };

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { ok: false as const, status: 401, error: "unauthorized" };

  // ปรับชื่อ table/column ให้ตรงกับของคุณ (เช่น admin_staff)
  const { data: staff } = await admin
    .from("admin_staff")
    .select("id, active")
    .eq("email", user.email)
    .maybeSingle();
  if (!staff || staff.active === false) return { ok: false as const, status: 403, error: "forbidden" };

  return { ok: true as const };
}

async function sendBatch(to: string[], text: string) {
  const res = await fetch(MULTICAST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`,
      "Content-Type": "application/json",
      "X-Line-Retry-Key": crypto.randomUUID(), // กันส่งซ้ำถ้า retry
    },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
  if (res.ok) return { ok: true, count: to.length };
  let detail = "";
  try { detail = JSON.stringify(await res.json()); } catch { /* empty */ }
  return { ok: false, count: 0, status: res.status, detail };
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { to?: string[]; text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }

  const text = (body.text ?? "").trim();
  const to = Array.from(new Set((body.to ?? []).filter(Boolean))); // dedupe + กันค่าว่าง

  if (!text) return NextResponse.json({ error: "ข้อความว่าง" }, { status: 400 });
  if (text.length > MAX_TEXT) return NextResponse.json({ error: `ข้อความยาวเกิน ${MAX_TEXT} ตัวอักษร` }, { status: 400 });
  if (to.length === 0) return NextResponse.json({ error: "ไม่มีผู้รับ (ต้องเป็นคนที่เชื่อม LINE แล้ว)" }, { status: 400 });

  let sent = 0;
  const errors: { status?: number; detail?: string }[] = [];
  for (let i = 0; i < to.length; i += BATCH) {
    const r = await sendBatch(to.slice(i, i + BATCH), text);
    if (r.ok) sent += r.count;
    else errors.push({ status: r.status, detail: r.detail });
  }

  return NextResponse.json({
    sent,
    total: to.length,
    failedBatches: errors.length,
    errors: errors.slice(0, 3), // ส่งกลับตัวอย่าง error ไว้ดีบัก
  });
}
