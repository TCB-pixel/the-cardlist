import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyBoothVendor } from "@/lib/booth-notify";

// Stripe แจ้งว่าชำระการจองโต๊ะสำเร็จ → ยืนยันการจอง (ทำซ้ำได้ ไม่เกิดผลซ้ำ)
export async function fulfilBoothBooking(
  supabase: SupabaseClient,
  p: { bookingId: string | null; paymentId: string; amountTotal: number }
) {
  if (!p.bookingId) {
    console.error("booth: payment without booking_id", p.paymentId);
    return;
  }
  const { data: b } = await supabase.from("booth_bookings").select("*").eq("id", p.bookingId).maybeSingle();
  if (!b) {
    console.error("booth: booking not found", p.bookingId);
    return;
  }
  if (b.status === "paid") return; // ยืนยันไปแล้ว (Stripe ส่งซ้ำ)

  // เคสจ่ายช้าหลังโต๊ะหลุด: ลองดึงโต๊ะกลับ ถ้ามีคนจองไปแล้ว → ติดธงให้ทีมงานคืนเงิน
  if (b.status !== "hold") {
    const { error } = await supabase.from("booth_booking_tables").update({ active: true }).eq("booking_id", b.id);
    if (error) {
      await supabase.from("booth_bookings")
        .update({ status: "needs_refund", payment_id: p.paymentId, paid_at: new Date().toISOString() })
        .eq("id", b.id);
      console.error("booth: paid but tables taken → needs_refund", b.id, error.message);
      return;
    }
  }

  const { error: upErr } = await supabase.from("booth_bookings")
    .update({ status: "paid", payment_id: p.paymentId, paid_at: new Date().toISOString() })
    .eq("id", b.id);
  if (upErr) throw new Error(upErr.message);

  // นับการใช้โค้ดส่วนลด (unique ที่ booking+code กันนับซ้ำ)
  if (b.discount_code_id) {
    const { error: rErr } = await supabase.from("discount_redemptions").insert({
      code_id: b.discount_code_id, user_id: b.user_id, booking_id: b.id, scope: "tables", amount: b.discount_amount,
    });
    if (!rErr) {
      const { count } = await supabase.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code_id", b.discount_code_id);
      await supabase.from("discount_codes").update({ used_count: count ?? 0 }).eq("id", b.discount_code_id);
    }
  }
  console.log("✅ Booth booking paid:", b.id);

  // แจ้ง Vendor ทาง LINE — ทำหลังยืนยันสำเร็จเท่านั้น และไม่ทำให้ webhook ล้ม
  await notifyBoothVendor(supabase, b.id);
}

// หน้าชำระเงินหมดอายุ/ถูกยกเลิก → คืนโต๊ะทันที (ไม่ต้องรอครบเวลากัน)
export async function releaseBoothBooking(supabase: SupabaseClient, bookingId: string | null) {
  if (!bookingId) return;
  const { data: b } = await supabase.from("booth_bookings").select("status").eq("id", bookingId).maybeSingle();
  if (!b || b.status !== "hold") return;
  await supabase.from("booth_booking_tables").update({ active: false }).eq("booking_id", bookingId);
  await supabase.from("booth_bookings").update({ status: "expired" }).eq("id", bookingId).eq("status", "hold");
}
