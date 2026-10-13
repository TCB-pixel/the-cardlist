import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, requireAdmin } from "@/lib/require-admin";
import { parseBoothSvg } from "@/lib/booth-layout";
import { releaseExpired } from "@/lib/booth";
import { notifyBoothVendor, notifyBoothStaff } from "@/lib/booth-notify";

export const maxDuration = 30;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET ?action=events            รายการงาน + สรุปจำนวนจอง
// GET ?action=bookings&eventId  รายการจองของงาน (พร้อมโต๊ะ/ผู้จอง)
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "booth:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  await releaseExpired();

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "events";

  if (action === "events") {
    const { data: events } = await adminDb.from("booth_events")
      .select("id, title, location, days, partial_open_at, hold_minutes, max_tables, pricing, active, created_at, layout")
      .order("created_at", { ascending: false });
    const out = [];
    for (const e of events ?? []) {
      const { data: paid } = await adminDb.from("booth_bookings").select("id").eq("event_id", e.id).eq("status", "paid");
      const layout = (e as any).layout;
      out.push({
        ...e,
        days: (e.days as string[]).map((d) => String(d).slice(0, 10)),
        layout: undefined,
        layoutInfo: layout ? { tables: layout.tables.length, types: Array.from(new Set(layout.tables.map((t: any) => t.type))), viewBox: layout.viewBox } : null,
        paidCount: paid?.length ?? 0,
      });
    }
    return NextResponse.json({ events: out });
  }

  if (action === "bookings") {
    const eventId = url.searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ error: "ไม่พบ eventId" }, { status: 400 });
    const { data: bookings } = await adminDb.from("booth_bookings").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
    const ids = (bookings ?? []).map((b: any) => b.id);
    const { data: rows } = ids.length
      ? await adminDb.from("booth_booking_tables").select("booking_id, table_id").in("booking_id", ids)
      : { data: [] as any[] };
    const tablesBy: Record<string, string[]> = {};
    for (const r of rows ?? []) (tablesBy[(r as any).booking_id] ??= []).push((r as any).table_id);
    return NextResponse.json({
      bookings: (bookings ?? []).map((b: any) => ({
        ...b,
        days: (b.days as string[]).map((d) => String(d).slice(0, 10)),
        tables: Array.from(new Set(tablesBy[b.id] ?? [])).sort((a, c) => a.localeCompare(c, "en", { numeric: true })),
      })),
    });
  }

  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}

// POST { action: "saveEvent", ... } | { action: "cancelBooking", bookingId }
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "booth:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => ({}));

  if (body.action === "cancelBooking") {
    const { data: b } = await adminDb.from("booth_bookings").select("id, status, stripe_session_id").eq("id", String(body.bookingId ?? "")).maybeSingle();
    if (!b) return NextResponse.json({ error: "ไม่พบรายการจอง" }, { status: 404 });
    if (b.status === "cancelled") return NextResponse.json({ ok: true });
    await adminDb.from("booth_booking_tables").update({ active: false }).eq("booking_id", b.id);
    await adminDb.from("booth_bookings").update({ status: "cancelled" }).eq("id", b.id);
    if (b.status === "hold" && b.stripe_session_id) {
      try { await new Stripe(process.env.STRIPE_SECRET_KEY!).checkout.sessions.expire(b.stripe_session_id); } catch { /* ข้าม */ }
    }
    // รายการที่จ่ายแล้ว: ปล่อยโต๊ะคืนให้ แต่การคืนเงินต้องทำเองที่ Stripe
    return NextResponse.json({ ok: true, refundNeeded: b.status === "paid" || b.status === "needs_refund" });
  }

  if (body.action === "resendStaff") {
    const r = await notifyBoothStaff(adminDb, String(body.bookingId ?? ""));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  if (body.action === "resendLine") {
    const r = await notifyBoothVendor(adminDb, String(body.bookingId ?? ""));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  if (body.action === "saveEvent") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "กรอกชื่องาน" }, { status: 400 });

    const days = Array.isArray(body.days) ? body.days.map(String) : [];
    if (days.length === 0 || days.some((d: string) => !DAY_RE.test(d))) {
      return NextResponse.json({ error: "วันจัดงานไม่ถูกต้อง (รูปแบบ ปปปป-ดด-วว)" }, { status: 400 });
    }

    const holdMinutes = Number(body.hold_minutes ?? 30);
    if (!Number.isInteger(holdMinutes) || holdMinutes < 30 || holdMinutes > 120) {
      return NextResponse.json({ error: "เวลากันโต๊ะต้องอยู่ระหว่าง 30–120 นาที (Stripe กำหนดขั้นต่ำ 30 นาที)" }, { status: 400 });
    }
    const maxTables = Number(body.max_tables ?? 4);
    if (!Number.isInteger(maxTables) || maxTables < 1 || maxTables > 50) {
      return NextResponse.json({ error: "จำนวนโต๊ะสูงสุดต่อครั้งไม่ถูกต้อง" }, { status: 400 });
    }

    const pricing: Record<string, unknown> = {};
    for (const [type, v] of Object.entries<any>(body.pricing ?? {})) {
      const full = Number(v?.full), perDay = Number(v?.per_day);
      if (!/^[A-Z]{1,3}$/.test(type) || !Number.isFinite(full) || full <= 0 || !Number.isFinite(perDay) || perDay <= 0) {
        return NextResponse.json({ error: `ราคาของโต๊ะ ${type} ไม่ถูกต้อง` }, { status: 400 });
      }
      pricing[type] = { label: String(v.label ?? `โต๊ะ ${type}`).slice(0, 40), size: String(v.size ?? "").slice(0, 40), full: Math.round(full), per_day: Math.round(perDay) };
    }

    const partialOpen = body.partial_open_at ? new Date(body.partial_open_at) : null;
    if (partialOpen && isNaN(partialOpen.getTime())) return NextResponse.json({ error: "วันเปิดจองบางวันไม่ถูกต้อง" }, { status: 400 });

    const row: Record<string, unknown> = {
      title, location: String(body.location ?? "").trim() || null,
      days, partial_open_at: partialOpen ? partialOpen.toISOString() : null,
      hold_minutes: holdMinutes, max_tables: maxTables, pricing, active: body.active === true,
    };

    let layout: any = undefined;
    if (typeof body.svg === "string" && body.svg.trim()) {
      try {
        layout = parseBoothSvg(body.svg);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "อ่านไฟล์ผังไม่สำเร็จ" }, { status: 400 });
      }
    }
    const vb = body.viewBox;
    if (Array.isArray(vb) && vb.length === 4 && vb.every((n: any) => Number.isFinite(Number(n))) && Number(vb[2]) > 0 && Number(vb[3]) > 0) {
      if (!layout) {
        const { data: cur } = body.id ? await adminDb.from("booth_events").select("layout").eq("id", body.id).maybeSingle() : { data: null };
        layout = (cur as any)?.layout ?? undefined;
      }
      if (layout) layout.viewBox = vb.map(Number);
    }

    // ถ้ามีการจองอยู่แล้ว ห้ามเปลี่ยนวันจัดงานหรือโครงผัง — กันโต๊ะ/วันที่จองไว้หลุดจากความจริง
    if (body.id) {
      const { data: cur } = await adminDb.from("booth_events").select("days, layout").eq("id", body.id).maybeSingle();
      const { count } = await adminDb.from("booth_booking_tables").select("id", { count: "exact", head: true }).eq("event_id", body.id).eq("active", true);
      if ((count ?? 0) > 0 && cur) {
        const curDays = (cur.days as string[]).map((d) => String(d).slice(0, 10)).join(",");
        if (curDays !== days.join(",")) return NextResponse.json({ error: "มีการจองอยู่แล้ว เปลี่ยนวันจัดงานไม่ได้" }, { status: 400 });
        if (layout && body.svg) {
          const oldIds = new Set((((cur as any).layout?.tables ?? []) as any[]).map((t) => t.id));
          const newIds = new Set(layout.tables.map((t: any) => t.id));
          const missing = [...oldIds].filter((id) => !newIds.has(id));
          if (missing.length) return NextResponse.json({ error: `มีการจองอยู่แล้ว ผังใหม่ต้องมีโต๊ะเดิมครบ (หายไป: ${missing.slice(0, 5).join(", ")})` }, { status: 400 });
        }
      }
    }

    if (layout) row.layout = layout;
    if (row.active && !(layout ?? (body.id ? true : false))) {
      return NextResponse.json({ error: "อัปโหลดไฟล์ผังก่อนเปิดรับจอง" }, { status: 400 });
    }

    if (body.id) {
      const { error } = await adminDb.from("booth_events").update(row).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, id: body.id, tables: layout?.tables?.length });
    }
    const { data, error } = await adminDb.from("booth_events").insert(row).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data.id, tables: layout?.tables?.length });
  }

  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}
