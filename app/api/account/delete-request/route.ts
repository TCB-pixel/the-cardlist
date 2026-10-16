import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { getUserFromRequest } from "@/lib/booth";
import { sendEmail } from "@/lib/order-notify";
import { sendLineMessage } from "@/lib/line-notify";
import { escapeHtml } from "@/lib/order-email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";

// ลูกค้าขอลบบัญชี (ข้อกำหนดของ Google Play / App Store) — ยังไม่ลบอัตโนมัติ
// เพราะคำสั่งซื้อ/การจองที่ชำระแล้วต้องเก็บเป็นหลักฐานบัญชี: แจ้งทีมงานชุดเดียวกับแจ้งเตือนออเดอร์
// (site_settings: order_notify_line_ids / order_notify_emails) ให้ดำเนินการภายใน 30 วัน
export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  const { reason } = await req.json().catch(() => ({}));
  const why = String(reason ?? "").slice(0, 500);

  const { data: p } = await adminDb
    .from("profiles")
    .select("username, display_name, first_name, last_name, phone, email, member_code, line_display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: settings } = await adminDb
    .from("site_settings")
    .select("key, value")
    .in("key", ["order_notify_line_ids", "order_notify_emails"]);
  const get = (k: string) => String((settings ?? []).find((s: any) => s.key === k)?.value ?? "");
  const split = (v: string) => v.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const lineIds = split(get("order_notify_line_ids"));
  const emails = split(get("order_notify_emails"));

  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.display_name || p?.line_display_name || "-";
  const rows: [string, string][] = [
    ["ชื่อ", name],
    ["Username", p?.username ?? "-"],
    ["อีเมล", user.email ?? p?.email ?? "-"],
    ["เบอร์โทร", p?.phone ?? "-"],
    ["รหัสสมาชิก", p?.member_code ?? "-"],
    ["User ID", user.id],
    ["เหตุผล", why || "-"],
  ];
  const text =
    "🗑️ มีคำขอลบบัญชีใหม่\n" +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    "\n\nโปรดดำเนินการภายใน 30 วัน และแจ้งลูกค้าเมื่อเสร็จ";

  const problems: string[] = [];
  await Promise.all(lineIds.map((id) => sendLineMessage(id, text).catch((e) => problems.push(String(e)))));
  if (emails.length > 0) {
    const html =
      `<div style="font-family:Arial,sans-serif;max-width:520px"><h2 style="margin:0 0 12px">🗑️ คำขอลบบัญชี</h2>` +
      `<table style="width:100%;border-collapse:collapse;font-size:14px">` +
      rows.map(([k, v]) => `<tr><td style="padding:3px 0;color:#71717a">${k}</td><td style="text-align:right">${escapeHtml(v)}</td></tr>`).join("") +
      `</table><p style="margin:16px 0 0;color:#71717a">โปรดดำเนินการภายใน 30 วัน (ข้อกำหนด Google Play / PDPA) · <a href="${SITE_URL}/admin/members">หลังบ้าน: สมาชิก</a></p></div>`;
    const r = await sendEmail(emails, `คำขอลบบัญชี: ${name}`, html);
    if (!r.ok) problems.push(r.error);
  }

  if (lineIds.length === 0 && emails.length === 0) {
    console.error("delete-request: no staff recipients configured", user.id);
    return NextResponse.json({ error: "no_recipients" }, { status: 500 });
  }
  if (problems.length > 0) console.error("delete-request notify problems:", problems.join("; "));
  return NextResponse.json({ ok: true });
}
