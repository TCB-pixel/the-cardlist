import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { carrierById, cleanTracking, trackingLooksValid } from "@/lib/carriers";
import { notifyShipped } from "@/lib/order-notify";

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── ตรวจสิทธิ์แอดมินฝั่ง server (frontend ซ่อนปุ่มอย่างเดียวไม่พอ) ──
async function requireAdmin(request: NextRequest) {
  const supabase = getAdminSupabase();

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false as const, error: "ไม่ได้เข้าสู่ระบบ" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return { ok: false as const, error: "token ไม่ถูกต้อง" };

  // เช็คจากตาราง admin_users ก่อน แล้วค่อย admin_staff
  const { data: au } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  if (au) return { ok: true as const, supabase, email: user.email };

  const { data: st } = await supabase
    .from("admin_staff")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  if (st) return { ok: true as const, supabase, email: user.email };

  return { ok: false as const, error: "ไม่มีสิทธิ์เข้าถึง" };
}

// ── GET: รายการออเดอร์ทั้งหมด + รายการสินค้า ──
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { data: orders, error } = await auth.supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: orders ?? [] });
}

// ── PATCH: อัปเดตสถานะ / เลขพัสดุ ──
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await request.json();
  const orderId: string | null = body.orderId ?? null;
  if (!orderId) return NextResponse.json({ error: "missing orderId" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof body.status === "string") updates.status = body.status;           // paid | shipped | cancelled
  if (typeof body.carrier === "string") {
    if (body.carrier && !carrierById(body.carrier)) {
      return NextResponse.json({ error: "ไม่รู้จักขนส่งนี้" }, { status: 400 });
    }
    updates.carrier = body.carrier || null;
  }
  if (typeof body.tracking_no === "string") updates.tracking_no = cleanTracking(body.tracking_no);
  if (typeof body.note === "string") updates.note = body.note;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });
  }

  // ── ก่อนบันทึก: ดูค่าเดิม เพื่อรู้ว่าเลขพัสดุเปลี่ยนจริงไหม (กันแจ้งซ้ำ) ──
  const { data: before } = await auth.supabase
    .from("orders")
    .select("status, carrier, tracking_no, shipped_notified_at, shipped_notify_tracking")
    .eq("id", orderId)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  const nextStatus = (updates.status as string | undefined) ?? before.status;
  const nextCarrier = (updates.carrier as string | null | undefined) ?? before.carrier;
  const nextTracking = (updates.tracking_no as string | undefined) ?? before.tracking_no ?? "";

  // จัดส่งแล้วต้องมีขนส่งและเลขพัสดุ ไม่งั้นลูกค้าตามพัสดุไม่ได้ — ปฏิเสธตั้งแต่ต้น
  if (nextStatus === "shipped") {
    if (!nextCarrier) return NextResponse.json({ error: "เลือกขนส่งก่อนกดจัดส่ง" }, { status: 400 });
    if (!nextTracking) return NextResponse.json({ error: "กรอกเลขพัสดุก่อนกดจัดส่ง" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── แจ้งลูกค้า: สถานะ shipped + มีเลข + (ยังไม่เคยแจ้ง หรือเลขเปลี่ยนจากที่เคยแจ้ง) ──
  let notify: unknown = null;
  const alreadyToldThisNumber =
    !!before.shipped_notified_at && before.shipped_notify_tracking === nextTracking;

  if (nextStatus === "shipped" && nextCarrier && nextTracking && !alreadyToldThisNumber) {
    try {
      const r = await notifyShipped(auth.supabase, orderId);
      if (r.ok) {
        await auth.supabase.from("orders").update({ shipped_notify_tracking: nextTracking }).eq("id", orderId);
      }
      notify = r;
    } catch (e: any) {
      // บันทึกสถานะสำเร็จแล้ว แจ้งลูกค้าพังต้องไม่ทำให้การจัดส่งดูเหมือนล้มเหลว
      console.error("notifyShipped failed:", e);
      notify = { ok: false, errors: [String(e?.message ?? e).slice(0, 200)] };
    }
  }

  return NextResponse.json({
    ok: true,
    notify,
    // เตือนเฉพาะรูปแบบเลขดูแปลก ไม่ปฏิเสธ (ขนส่งเปลี่ยนรูปแบบได้)
    warning:
      nextCarrier && nextTracking && !trackingLooksValid(nextCarrier, nextTracking)
        ? "รูปแบบเลขพัสดุดูไม่ตรงกับขนส่งที่เลือก — ตรวจสอบอีกครั้งว่าพิมพ์ถูกไหม"
        : null,
  });
}
