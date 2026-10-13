import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBoothFlex } from "@/lib/line-booth-flex";
import { pushFlex } from "@/lib/line-order-flex";
import { fmtDay } from "@/lib/booth";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";

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
    const { data: b } = await supabase.from("booth_bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!b) return { ok: false, error: "ไม่พบรายการจอง" };
    if (b.status !== "paid") return { ok: false, error: "รายการนี้ยังไม่ได้ชำระเงิน" };

    const [{ data: ev }, { data: rows }, { data: profile }] = await Promise.all([
      supabase.from("booth_events").select("title, location, days").eq("id", b.event_id).maybeSingle(),
      supabase.from("booth_booking_tables").select("table_id").eq("booking_id", b.id),
      supabase.from("profiles").select("line_user_id").eq("id", b.user_id).maybeSingle(),
    ]);
    if (!profile?.line_user_id) return await record("ผู้จองไม่ได้ผูกบัญชี LINE (ดูการจองได้ที่หน้าเว็บ)");

    const tables = Array.from(new Set((rows ?? []).map((r: any) => r.table_id as string))).sort((x, y) =>
      x.localeCompare(y, "en", { numeric: true })
    );
    const days = (b.days as string[]).map((d) => String(d).slice(0, 10));
    const evDays = ((ev?.days ?? []) as string[]).length;
    const dayText = days.map(fmtDay).join(", ");
    const daysLabel = evDays > 0 && days.length === evDays ? `ครบ ${days.length} วัน (${dayText})` : dayText;

    const flex = buildBoothFlex({
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
    });
    const r = await pushFlex(profile.line_user_id, flex as any);
    return await record(r.ok ? null : r.error);
  } catch (e: any) {
    console.error("notifyBoothVendor failed:", e);
    return await record(String(e?.message ?? e).slice(0, 300));
  }
}
