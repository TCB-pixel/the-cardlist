import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";
import { cleanTracking } from "@/lib/carriers";
import { notifyShipped } from "@/lib/order-notify";
import {
  IshipError, checkPrice, createOrder, hostFor,
  type IshipEnv, type IshipParty, type IshipParcel,
} from "@/lib/iship";

export const maxDuration = 60;

// อ่านค่าตั้งต้นจาก site_settings (แก้ได้โดยไม่ต้อง deploy)
async function loadSettings() {
  const { data } = await adminDb.from("site_settings").select("key, value").like("key", "iship_%");
  const m = new Map((data ?? []).map((r: any) => [r.key as string, (r.value ?? "") as string]));
  const num = (k: string, d: number) => {
    const n = Number(m.get(k));
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  const env: IshipEnv = m.get("iship_env") === "prod" ? "prod" : "uat"; // ไม่รู้ค่า = UAT เสมอ
  const parcel: IshipParcel = {
    weightKg: num("iship_parcel_weight_kg", 0.5),
    widthCm: num("iship_parcel_width_cm", 20),
    lengthCm: num("iship_parcel_length_cm", 25),
    heightCm: num("iship_parcel_height_cm", 10),
  };
  const sender: IshipParty = {
    name: m.get("iship_sender_name") ?? "",
    phone: m.get("iship_sender_phone") ?? "",
    address: m.get("iship_sender_address") ?? "",
    district: m.get("iship_sender_district") ?? "",
    amphure: m.get("iship_sender_amphure") ?? "",
    province: m.get("iship_sender_province") ?? "",
    zipcode: m.get("iship_sender_zipcode") ?? "",
  };
  return { env, parcel, sender, courier: m.get("iship_default_courier") || "KerryExpress" };
}

const missingParty = (p: IshipParty, label: string): string[] =>
  (["name", "phone", "address", "district", "amphure", "province", "zipcode"] as const)
    .filter((k) => !String(p[k] ?? "").trim())
    .map((k) => `${label}: ขาด ${k}`);

// แปลงรหัสขนส่งของ iShip เป็นรหัสขนส่งในระบบเรา (ไม่รู้จัก = null → ไม่ขึ้นสถานะจัดส่งเอง ให้แอดมินเลือกเอง)
const ourCarrier = (code: string): string | null =>
  /kerry/i.test(code) ? "kerry" : /thp|thai|post|ems/i.test(code) ? "thaipost" : null;

const thaiPhone = (p: string) => (p ?? "").replace(/\D/g, "").replace(/^66/, "0");

// ---------- GET : เตรียมข้อมูลให้แอดมินตรวจก่อนสร้าง (ไม่หักเครดิต ไม่สร้างอะไร) ----------
// ?orderId=...   คืนที่อยู่ที่เดาแยกให้ + ค่าตั้งต้น + สถานะว่าสร้างไปแล้วหรือยัง
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "orders:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const orderId = new URL(req.url).searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ error: "ไม่พบ order id" }, { status: 400 });

  const { data: o } = await adminDb
    .from("orders")
    .select("id, status, recipient_name, phone, address_line1, address_line2, district, province, postal_code, iship_tracking, iship_env, iship_created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  const s = await loadSettings();

  // ที่อยู่จาก Stripe ไม่แยกตำบล/อำเภอชัด (ลูกค้าพิมพ์เอง) — เดาเบื้องต้นให้แอดมินแก้ ไม่ส่งต่อโดยไม่ตรวจ
  // line2 มักเป็นตำบล/แขวง, city(district ในตารางเรา) มักเป็นอำเภอ/เขต
  const guess: IshipParty = {
    name: o.recipient_name ?? "",
    phone: thaiPhone(o.phone ?? ""),
    address: o.address_line1 ?? "",
    district: o.address_line2 ?? "",
    amphure: o.district ?? "",
    province: o.province ?? "",
    zipcode: o.postal_code ?? "",
  };

  return NextResponse.json({
    order: { id: o.id, status: o.status },
    already: o.iship_tracking
      ? { tracking: o.iship_tracking, env: o.iship_env, at: o.iship_created_at }
      : null,
    env: s.env,
    host: hostFor(s.env),
    courier: s.courier,
    parcel: s.parcel,
    sender: s.sender,
    senderMissing: missingParty(s.sender, "ผู้ส่ง"),
    recipient: guess,
  });
}

// ---------- POST : action = "price" (เช็คราคา ไม่หักเงิน) | "create" (สร้างพัสดุจริง หักเครดิต) ----------
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "orders:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const { action, orderId } = body ?? {};
    if (!orderId) return NextResponse.json({ error: "ไม่พบ order id" }, { status: 400 });
    if (action !== "price" && action !== "create") {
      return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
    }

    const s = await loadSettings();
    const courier = String(body.courier ?? s.courier);
    const dst: IshipParty = {
      name: String(body.recipient?.name ?? "").trim(),
      phone: thaiPhone(body.recipient?.phone ?? ""),
      address: String(body.recipient?.address ?? "").trim(),
      district: String(body.recipient?.district ?? "").trim(),
      amphure: String(body.recipient?.amphure ?? "").trim(),
      province: String(body.recipient?.province ?? "").trim(),
      zipcode: String(body.recipient?.zipcode ?? "").trim(),
    };

    const problems = [...missingParty(dst, "ผู้รับ"), ...missingParty(s.sender, "ผู้ส่ง")];
    if (!/^\d{5}$/.test(dst.zipcode)) problems.push("ผู้รับ: รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก");
    if (!/^0\d{8,9}$/.test(dst.phone)) problems.push("ผู้รับ: เบอร์โทรไม่ถูกต้อง");
    if (problems.length) {
      return NextResponse.json({ error: "ข้อมูลยังไม่ครบ", problems }, { status: 400 });
    }

    // ── เช็คราคา: อ่านอย่างเดียว ไม่หักเครดิต ──
    if (action === "price") {
      const r = await checkPrice({ env: s.env, courierCode: courier, src: s.sender, dst, parcel: s.parcel });
      return NextResponse.json({ ok: true, env: s.env, ...r });
    }

    // ── สร้างพัสดุจริง ──
    const { data: o } = await adminDb
      .from("orders")
      .select("id, status, iship_tracking")
      .eq("id", orderId)
      .maybeSingle();
    if (!o) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
    if (o.status !== "paid" && o.status !== "shipped") {
      return NextResponse.json({ error: `ออเดอร์สถานะ "${o.status}" สร้างพัสดุไม่ได้ — ต้องชำระเงินแล้วเท่านั้น` }, { status: 400 });
    }
    if (o.iship_tracking) {
      return NextResponse.json(
        { error: `ออเดอร์นี้สร้างพัสดุไปแล้ว (${o.iship_tracking}) — ไม่สร้างซ้ำเพื่อกันหักเครดิตสองรอบ` },
        { status: 409 }
      );
    }
    if (body.confirmEnv !== s.env) {
      // กันกดตอนหน้าจอเก่าค้างอยู่ — แอดมินเห็นว่าเป็น UAT แต่ระบบสลับเป็น prod ไปแล้ว (หรือกลับกัน)
      return NextResponse.json(
        { error: `สภาพแวดล้อมเปลี่ยนไประหว่างที่เปิดหน้านี้ (ตอนนี้เป็น ${s.env}) — เปิดหน้าต่างใหม่แล้วตรวจอีกครั้ง` },
        { status: 409 }
      );
    }

    // จองช่องก่อนยิง: ใส่ค่า placeholder กันสองคำขอวิ่งพร้อมกัน (ดัชนี unique ที่ iship_tracking กันซ้ำอีกชั้น)
    const claim = await adminDb
      .from("orders")
      .update({ iship_created_by: auth.caller.email, iship_created_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("iship_created_at", null)
      .select("id");
    if (!claim.data || claim.data.length === 0) {
      return NextResponse.json({ error: "มีคำขอสร้างพัสดุของออเดอร์นี้กำลังทำงานอยู่ — รอสักครู่แล้วเปิดดูใหม่" }, { status: 409 });
    }

    let created;
    try {
      created = await createOrder({
        env: s.env,
        courierCode: courier,
        customOrderId: String(orderId),
        src: s.sender,
        dst,
        parcel: s.parcel,
        remark: "สินค้าการ์ดเกม กรุณาอย่าโยน อย่าทับ",
      });
    } catch (e: any) {
      // ปล่อยช่องที่จองไว้คืน เฉพาะเมื่อมั่นใจว่า iShip ไม่ได้สร้าง (4xx) — ถ้าไม่แน่ใจ (timeout) คงล็อกไว้ให้คนตรวจก่อน
      if (e instanceof IshipError && e.safeToRetry) {
        await adminDb.from("orders").update({ iship_created_at: null, iship_created_by: null }).eq("id", orderId);
      }
      const unsure = e instanceof IshipError && !e.safeToRetry;
      return NextResponse.json(
        {
          error: e?.message ?? "สร้างพัสดุไม่สำเร็จ",
          unsure, // true = ไม่รู้ว่าสร้างแล้วหรือยัง ห้ามกดซ้ำ ให้ตรวจที่ iShip
        },
        { status: e instanceof IshipError ? (e.status >= 400 && e.status < 600 ? e.status : 502) : 500 }
      );
    }

    await adminDb
      .from("orders")
      .update({
        iship_tracking: created.trackingNumber,
        iship_ref: created.ref,
        iship_courier: courier,
        iship_env: s.env,
      })
      .eq("id", orderId);

    // ── ต่อไปหน้าจัดส่ง: เฉพาะโหมดจริง ──
    // เลข UAT เป็นเลขทดสอบ ห้ามส่งให้ลูกค้าจริงหรือเปลี่ยนสถานะออเดอร์จริง
    let shipped = false;
    let notify: unknown = null;
    const carrier = ourCarrier(courier);
    // เฉพาะออเดอร์ที่ยัง "ชำระแล้ว" — ออเดอร์ที่จัดส่งไปแล้วห้ามเขียนทับเลขพัสดุเดิมที่แจ้งลูกค้าไปแล้ว
    if (s.env === "prod" && carrier && o.status === "paid") {
      const tracking = cleanTracking(created.trackingNumber);
      const { error: upErr } = await adminDb
        .from("orders")
        .update({ tracking_no: tracking, carrier, status: "shipped" })
        .eq("id", orderId);
      if (!upErr) {
        shipped = true;
        try {
          const r = await notifyShipped(adminDb, orderId);
          if (r.ok) await adminDb.from("orders").update({ shipped_notify_tracking: tracking }).eq("id", orderId);
          notify = r;
        } catch (e: any) {
          console.error("notifyShipped failed:", e);
          notify = { ok: false, errors: [String(e?.message ?? e).slice(0, 200)] };
        }
      }
    }

    return NextResponse.json({ ok: true, env: s.env, tracking: created.trackingNumber, ref: created.ref, shipped, notify });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
