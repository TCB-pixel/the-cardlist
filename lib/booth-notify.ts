import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBoothFlex, type BoothFlexInput } from "@/lib/line-booth-flex";
import { pushFlex } from "@/lib/line-order-flex";
import { escapeHtml } from "@/lib/order-email";
import { sendEmail } from "@/lib/order-notify";
import { fmtDay } from "@/lib/booth";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";
const split = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

// รวบรวมข้อมูลการ์ดจากฐานข้อมูล (ใช้ทั้งแจ้ง Vendor และแจ้งทีมงาน)
async function loadCard(supabase: SupabaseClient, bookingId: string) {
  const { data: b } = await supabase.from("booth_bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!b) return { error: "ไม่พบรายการจอง" as const };
  if (b.status !== "paid") return { error: "รายการนี้ยังไม่ได้ชำระเงิน" as const };

  const [{ data: ev }, { data: rows }, { data: profile }] = await Promise.all([
    supabase.from("booth_events").select("title, location, days").eq("id", b.event_id).maybeSingle(),
    supabase.from("booth_booking_tables").select("table_id").eq("booking_id", b.id),
    supabase.from("profiles").select("line_user_id").eq("id", b.user_id).maybeSingle(),
  ]);

  const tables = Array.from(new Set((rows ?? []).map((r: any) => r.table_id as string))).sort((x, y) =>
    x.localeCompare(y, "en", { numeric: true })
  );
  const days = (b.days as string[]).map((d) => String(d).slice(0, 10));
  const evDays = ((ev?.days ?? []) as string[]).length;
  const dayText = days.map(fmtDay).join(", ");
  const daysLabel = evDays > 0 && days.length === evDays ? `ครบ ${days.length} วัน (${dayText})` : dayText;

  const input: BoothFlexInput = {
    eventTitle: ev?.title ?? "งานอีเวนต์",
    location: ev?.location ?? null,
    shopName: b.shop_name ?? "-",
    tables,
    daysLabel,
    subtotal: Number(b.subtotal),
    discountCode: b.discount_code,
    discountAmount: Number(b.discount_amount),
    cardFee: Number(b.card_fee),
    total: Number(b.total),
    bookingRef: String(b.id).slice(0, 8).toUpperCase(),
    siteUrl: SITE_URL,
    contactName: b.contact_name,
    phone: b.phone,
    productTypes: ((b.vendor_info?.product_types ?? []) as string[]).join(", ") || null,
    socialUrl: (b.vendor_info?.social_url as string | null) ?? null,
  };
  return { b, input, lineUserId: (profile?.line_user_id as string | null) ?? null };
}

// ส่งการ์ดยืนยันการจองให้ Vendor ทาง LINE — ไม่ throw ผลลัพธ์จดไว้ที่ booth_bookings
// (การยืนยันการจองเสร็จก่อนเสมอ LINE พังก็ไม่ทำให้การจองหาย)
export async function notifyBoothVendor(
  supabase: SupabaseClient,
  bookingId: string
): Promise<{ ok: boolean; error?: string }> {
  const record = async (error: string | null) => {
    await supabase
      .from("booth_bookings")
      .update(
        error
          ? { line_notified_at: null, line_notify_error: error }
          : { line_notified_at: new Date().toISOString(), line_notify_error: null }
      )
      .eq("id", bookingId);
    return error ? { ok: false, error } : { ok: true };
  };

  try {
    const card = await loadCard(supabase, bookingId);
    if ("error" in card) return { ok: false, error: card.error };
    if (!card.lineUserId) return await record("ผู้จองไม่ได้ผูกบัญชี LINE (ดูการจองได้ที่หน้าเว็บ)");
    const r = await pushFlex(card.lineUserId, buildBoothFlex(card.input) as any);
    return await record(r.ok ? null : r.error);
  } catch (e: any) {
    console.error("notifyBoothVendor failed:", e);
    return await record(String(e?.message ?? e).slice(0, 300));
  }
}

// แจ้งทีมงานว่ามีการจองโต๊ะใหม่ (LINE การ์ด + อีเมล) ผู้รับชุดเดียวกับแจ้งเตือนออเดอร์ที่ตั้งใน /admin/settings
// ไม่ throw — ปัญหาจดไว้ที่ booth_bookings.staff_notify_error
export async function notifyBoothStaff(
  supabase: SupabaseClient,
  bookingId: string
): Promise<{ ok: boolean; error?: string }> {
  const problems: string[] = [];
  try {
    const card = await loadCard(supabase, bookingId);
    if ("error" in card) return { ok: false, error: card.error };

    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["order_notify_line_ids", "order_notify_emails"]);
    const get = (k: string) => (settings ?? []).find((s: any) => s.key === k)?.value ?? "";
    const lineIds = split(get("order_notify_line_ids"));
    const emails = split(get("order_notify_emails"));
    const i = card.input;

    if (lineIds.length > 0) {
      const flex = buildBoothFlex({ ...i, forStaff: true });
      const results = await Promise.all(lineIds.map((id) => pushFlex(id, flex as any)));
      results.forEach((r) => { if (!r.ok) problems.push(`LINE ทีมงาน: ${r.error}`); });
    }

    if (emails.length > 0) {
      const sumRows =
        `<tr><td style="padding:3px 0;color:#71717a">ยอดโต๊ะ</td><td style="text-align:right">฿${i.subtotal.toLocaleString()}</td></tr>` +
        (i.discountAmount > 0
          ? `<tr><td style="padding:3px 0;color:#16a34a">ส่วนลด${i.discountCode ? ` (${escapeHtml(i.discountCode)})` : ""}</td><td style="text-align:right;color:#16a34a">-฿${i.discountAmount.toLocaleString()}</td></tr>`
          : "") +
        (i.cardFee > 0
          ? `<tr><td style="padding:3px 0;color:#71717a">ค่าธรรมเนียมบัตร</td><td style="text-align:right">฿${i.cardFee.toLocaleString()}</td></tr>`
          : "") +
        `<tr><td style="padding:6px 0 0"><b>ชำระแล้ว</b></td><td style="text-align:right"><b>฿${i.total.toLocaleString()}</b></td></tr>`;
      const html =
        `<div style="font-family:Arial,sans-serif;max-width:520px">` +
        `<h2 style="margin:0 0 4px">🪑 มีการจองโต๊ะใหม่ #${i.bookingRef}</h2>` +
        `<p style="color:#71717a;margin:0 0 16px">${escapeHtml(i.eventTitle)}</p>` +
        `<table style="width:100%;border-collapse:collapse;font-size:14px">` +
        `<tr><td style="padding:3px 0;color:#71717a">ร้าน</td><td style="text-align:right">${escapeHtml(i.shopName)}</td></tr>` +
        `<tr><td style="padding:3px 0;color:#71717a">ผู้ติดต่อ</td><td style="text-align:right">${escapeHtml(i.contactName ?? "-")} · ${escapeHtml(i.phone ?? "-")}</td></tr>` +
        (i.productTypes ? `<tr><td style="padding:3px 0;color:#71717a">สินค้า</td><td style="text-align:right">${escapeHtml(i.productTypes)}</td></tr>` : "") +
        (i.socialUrl ? `<tr><td style="padding:3px 0;color:#71717a">เพจ/โซเชียล</td><td style="text-align:right">${escapeHtml(i.socialUrl)}</td></tr>` : "") +
        `<tr><td style="padding:3px 0;color:#71717a">โต๊ะ</td><td style="text-align:right"><b>${escapeHtml(i.tables.join(", "))}</b></td></tr>` +
        `<tr><td style="padding:3px 0;color:#71717a">วันที่</td><td style="text-align:right">${escapeHtml(i.daysLabel)}</td></tr>` +
        `${sumRows}</table>` +
        `<p style="margin:20px 0 0"><a href="${SITE_URL}/admin/booth">เปิดหลังบ้านเพื่อดูรายการจอง</a></p></div>`;
      const r = await sendEmail(emails, `🪑 จองโต๊ะใหม่ · ${i.shopName} · ฿${i.total.toLocaleString()}`, html);
      if (!r.ok) problems.push(`อีเมลทีมงาน: ${r.error}`);
    }

    if (lineIds.length === 0 && emails.length === 0) {
      problems.push("ยังไม่ได้ตั้งผู้รับแจ้งเตือนที่ /admin/settings");
    }
  } catch (e: any) {
    console.error("notifyBoothStaff failed:", e);
    problems.push(String(e?.message ?? e).slice(0, 200));
  }

  const error = problems.length ? problems.join(" | ").slice(0, 500) : null;
  await supabase
    .from("booth_bookings")
    .update(error ? { staff_notified_at: null, staff_notify_error: error } : { staff_notified_at: new Date().toISOString(), staff_notify_error: null })
    .eq("id", bookingId);
  return error ? { ok: false, error } : { ok: true };
}
