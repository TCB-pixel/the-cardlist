"use client";
import { useState, useEffect, useCallback } from "react";
import BottomNav from "@/components/BottomNav";
import HeroBanner from "@/components/HeroBanner";
import { Banner, DEFAULT_TOURNAMENT_BANNERS } from "@/lib/banners";
import { createClient } from "@/lib/supabase";
import type { Event } from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────────────────

type EventWithBooking = Event & { userBooked?: boolean; userBookingId?: string };

type VendorForm = {
  shop_name: string;
  contact_name: string;
  phone: string;
  description: string;
  booth_type: "single" | "double" | "large";
  event_id: string;
};

// ─── Config ────────────────────────────────────────────────────────────────

const TCG_COLOR: Record<string, string> = {
  "onepiece": "#E24B4A", "pokemon": "#EF9F27",
  "mtg": "#7F77DD", "dragonball": "#1D9E75",
};

const BOOTH_CONFIG = {
  single: { label: "โต๊ะเดี่ยว",  size: "1 โต๊ะ · 2×1.5 ม.", price: 1500 },
  double: { label: "โต๊ะคู่",     size: "2 โต๊ะ · 4×1.5 ม.", price: 2800 },
  large:  { label: "บูธใหญ่",     size: "4 โต๊ะ · 4×3 ม.",   price: 5000 },
};

const TABS = ["อีเวนต์", "จองโต๊ะ Vendor"];

const EMPTY_VENDOR: VendorForm = {
  shop_name: "", contact_name: "", phone: "",
  description: "", booth_type: "single", event_id: "",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

// ─── QR Code component ─────────────────────────────────────────────────────

function MiniQR({ value }: { value: string }) {
  const cells = Array.from({ length: 25 }).map((_, i) => {
    const c = value.charCodeAt(i % value.length);
    return (c + i * 7 + Math.floor(i / 5) * 3) % 3 !== 0;
  });
  const corners = [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24];
  return (
    <div className="w-24 h-24 bg-white border border-zinc-200 rounded-xl flex items-center justify-center p-2 mx-auto">
      <div className="grid grid-cols-5 gap-0.5 w-full h-full">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className={`rounded-sm ${corners.includes(i) || cells[i] ? "bg-zinc-900" : "bg-white border border-zinc-100"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function TournamentPage() {
  const supabase = createClient();

  // Banner
  const [banners, setBanners] = useState<Banner[]>(DEFAULT_TOURNAMENT_BANNERS);

  // Auth
  const [userId, setUserId] = useState<string | null>(null);

  // Events
  const [events, setEvents] = useState<EventWithBooking[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // UI
  const [activeTab, setActiveTab] = useState("อีเวนต์");
  const [selectedEvent, setSelectedEvent] = useState<EventWithBooking | null>(null);
  const [registering, setRegistering] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [successEvent, setSuccessEvent] = useState<EventWithBooking | null>(null);
  const [successQR, setSuccessQR] = useState("");

  // Vendor
  const [vendorForm, setVendorForm] = useState<VendorForm>(EMPTY_VENDOR);
  const [vendorSubmitting, setVendorSubmitting] = useState(false);
  const [vendorSuccess, setVendorSuccess] = useState(false);
  const [vendorError, setVendorError] = useState("");
  const [vendorBookings, setVendorBookings] = useState<any[]>([]);

  // ── Load banners ──
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("banners").select("*")
        .eq("type", "tournament").eq("active", true).order("order");
      if (data?.length) setBanners(data.map((r: any) => ({
        id: r.id, type: r.type, title: r.title, subtitle: r.subtitle,
        badge: r.badge, ctaLabel: r.cta_label, ctaHref: r.cta_href,
        ctaSecondaryLabel: r.cta_secondary_label ?? "",
        ctaSecondaryHref: r.cta_secondary_href ?? "",
        bgColor: r.bg_color, imageUrl: r.image_url,
        productImageUrl: r.product_image_url,
        active: r.active, order: r.order,
      })));
    }
    load();
  }, []);

  // ── Load session + events + bookings ──
  const loadAll = useCallback(async () => {
    setEventsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id ?? null;
    setUserId(uid);

    // Load events
    const { data: evData } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });

    if (!evData) { setEventsLoading(false); return; }

    // Load user's bookings
    let bookedEventIds: Record<string, string> = {};
    if (uid) {
      const { data: bData } = await supabase
        .from("bookings")
        .select("id, event_id")
        .eq("user_id", uid)
        .eq("status", "confirmed");
      bData?.forEach((b: any) => { bookedEventIds[b.event_id] = b.id; });
    }

    setEvents(evData.map((e: Event) => ({
      ...e,
      userBooked: !!bookedEventIds[e.id],
      userBookingId: bookedEventIds[e.id],
    })));

    // Load vendor bookings
    if (uid) {
      const { data: vData } = await supabase
        .from("vendor_bookings")
        .select("*, events(title, date)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      setVendorBookings(vData ?? []);
    }

    setEventsLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Register for tournament ──
  async function handleRegister(event: EventWithBooking) {
    if (!userId) { window.location.href = "/login"; return; }
    setRegistering(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          user_id: userId,
          event_id: event.id,
          status: "confirmed",
        })
        .select("qr_code")
        .single();
      if (error) throw error;
      setSuccessEvent(event);
      setSuccessQR(data.qr_code);
      await loadAll();
    } catch (err: any) {
      alert(err?.message ?? "ลงทะเบียนไม่สำเร็จ");
    } finally {
      setRegistering(false);
      setSelectedEvent(null);
    }
  }

  // ── Cancel registration ──
  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
    await loadAll();
    setCancellingId(null);
  }

  // ── Submit vendor booking ──
  async function handleVendorSubmit() {
    if (!userId) { window.location.href = "/login"; return; }
    if (!vendorForm.shop_name || !vendorForm.contact_name || !vendorForm.phone || !vendorForm.event_id) {
      setVendorError("กรุณากรอกข้อมูลให้ครบ"); return;
    }
    setVendorSubmitting(true);
    setVendorError("");
    try {
      const { error } = await supabase.from("vendor_bookings").insert({
        user_id: userId,
        event_id: vendorForm.event_id,
        shop_name: vendorForm.shop_name,
        contact_name: vendorForm.contact_name,
        phone: vendorForm.phone,
        description: vendorForm.description,
        booth_type: vendorForm.booth_type,
        booth_price: BOOTH_CONFIG[vendorForm.booth_type].price,
        status: "pending",
      });
      if (error) throw error;
      setVendorSuccess(true);
      setVendorForm(EMPTY_VENDOR);
      await loadAll();
    } catch (err: any) {
      setVendorError(err?.message ?? "ส่งคำขอไม่สำเร็จ");
    } finally {
      setVendorSubmitting(false);
    }
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 transition-colors";

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between px-4 h-12">
          <span className="text-sm font-semibold text-zinc-900 tracking-wide">Events & Tournament</span>
        </div>
      </header>

      <HeroBanner banners={banners} intervalMs={4000} />

      {/* Tabs */}
      <div className="flex bg-white border-b border-zinc-100">
        {TABS.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 text-xs py-3 tracking-wide border-b-2 transition-colors ${activeTab === t ? "border-zinc-900 text-zinc-900 font-semibold" : "border-transparent text-zinc-400"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB: อีเวนต์ ── */}
      {activeTab === "อีเวนต์" && (
        <div className="px-4 py-4 space-y-3">
          {eventsLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-32 bg-zinc-100 rounded-2xl animate-pulse" />)
          ) : events.length === 0 ? (
            <div className="card px-5 py-10 text-center">
              <p className="text-sm text-zinc-400">ยังไม่มีอีเวนต์ในขณะนี้</p>
            </div>
          ) : (
            events.map((ev) => {
              const remaining = ev.max_slots - ev.booked_slots;
              const pct = Math.round((ev.booked_slots / ev.max_slots) * 100);
              const full = remaining <= 0;
              const color = TCG_COLOR[ev.tcg] ?? "#888";
              const d = new Date(ev.date);
              return (
                <div key={ev.id} className="card overflow-hidden">
                  <div className="px-4 py-4">
                    <div className="flex gap-3 items-start">
                      <div className="bg-zinc-900 rounded-xl px-2.5 py-2 text-center min-w-[44px] flex-shrink-0">
                        <div className="text-lg font-bold text-white leading-none">
                          {d.getDate().toString().padStart(2,"0")}
                        </div>
                        <div className="text-[8px] text-zinc-400 tracking-wider mt-0.5">
                          {d.toLocaleDateString("en",{month:"short"}).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-[9px] tracking-wider text-zinc-400 font-semibold">
                            {ev.tcg} · {ev.format}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-zinc-900">{ev.title}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">{ev.location} · {ev.time.slice(0,5)} น.</p>
                      </div>
                    </div>

                    {ev.description && (
                      <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">{ev.description}</p>
                    )}

                    <div className="mt-3">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[10px] text-zinc-500">
                          ที่นั่ง{remaining > 0 ? ` คงเหลือ ${remaining}` : " เต็มแล้ว"} / {ev.max_slots}
                        </span>
                        <span className="text-[10px] text-zinc-500">ฟรี</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-zinc-900"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {ev.userBooked ? (
                      <div className="mt-3 flex gap-2">
                        <div className="flex-1 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <circle cx="7" cy="7" r="6" fill="#16a34a"/>
                            <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-[11px] text-green-700 font-semibold">ลงทะเบียนแล้ว</span>
                        </div>
                        <button
                          onClick={() => handleCancel(ev.userBookingId!)}
                          disabled={cancellingId === ev.userBookingId}
                          className="text-[11px] text-red-400 border border-red-100 rounded-xl px-3 py-2.5 disabled:opacity-40"
                        >
                          {cancellingId === ev.userBookingId ? "..." : "ยกเลิก"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => !full && setSelectedEvent(ev)}
                        disabled={full}
                        className={`mt-3 w-full text-xs font-semibold py-2.5 rounded-xl ${full ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" : "bg-zinc-900 text-white active:opacity-70"}`}
                      >
                        {full ? "ที่นั่งเต็ม" : userId ? "ลงทะเบียน" : "เข้าสู่ระบบเพื่อลงทะเบียน"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: จองโต๊ะ Vendor ── */}
      {activeTab === "จองโต๊ะ Vendor" && (
        <div className="px-4 py-4 space-y-4">

          {/* My vendor bookings */}
          {vendorBookings.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 tracking-widest uppercase">การจองของฉัน</p>
              {vendorBookings.map((b) => (
                <div key={b.id} className="card px-4 py-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900">{b.shop_name}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {BOOTH_CONFIG[b.booth_type as keyof typeof BOOTH_CONFIG]?.label} · ฿{b.booth_price.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-zinc-400">{b.events?.title}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      b.status === "approved"  ? "bg-green-50 text-green-700" :
                      b.status === "rejected"  ? "bg-red-50 text-red-700" :
                      b.status === "cancelled" ? "bg-zinc-100 text-zinc-500" :
                      "bg-amber-50 text-amber-700"
                    }`}>
                      {b.status === "approved" ? "อนุมัติแล้ว" :
                       b.status === "rejected" ? "ไม่อนุมัติ" :
                       b.status === "cancelled" ? "ยกเลิก" : "รอการตรวจสอบ"}
                    </span>
                  </div>
                  {b.admin_note && (
                    <p className="text-[10px] text-zinc-500 mt-2 bg-zinc-50 rounded-lg px-3 py-2">
                      หมายเหตุ: {b.admin_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Vendor booking form */}
          {vendorSuccess ? (
            <div className="card px-5 py-8 text-center">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L19 7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm font-bold text-zinc-900 mb-1">ส่งคำขอสำเร็จ!</p>
              <p className="text-[11px] text-zinc-400 mb-4">ทีมงานจะตรวจสอบและแจ้งผลภายใน 3 วันทำการ</p>
              <button onClick={() => setVendorSuccess(false)} className="btn-primary px-6 py-2.5">
                จองเพิ่มเติม
              </button>
            </div>
          ) : (
            <div className="card px-4 py-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900 mb-1">จองโต๊ะ Vendor</p>
                <p className="text-[11px] text-zinc-400">กรอกข้อมูลร้านค้าเพื่อจองพื้นที่ในงาน</p>
              </div>

              {/* Select event */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">อีเวนต์ *</label>
                <select
                  className={inputCls}
                  value={vendorForm.event_id}
                  onChange={e => setVendorForm(f => ({ ...f, event_id: e.target.value }))}
                >
                  <option value="">เลือกอีเวนต์</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} — {formatDate(ev.date)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Booth type */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-2">ประเภทโต๊ะ *</label>
                <div className="space-y-2">
                  {(Object.entries(BOOTH_CONFIG) as [keyof typeof BOOTH_CONFIG, typeof BOOTH_CONFIG.single][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setVendorForm(f => ({ ...f, booth_type: key }))}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                        vendorForm.booth_type === key
                          ? "bg-zinc-900 border-zinc-900 text-white"
                          : "border-zinc-200 text-zinc-700"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-semibold">{cfg.label}</p>
                        <p className={`text-[10px] mt-0.5 ${vendorForm.booth_type === key ? "text-zinc-400" : "text-zinc-400"}`}>
                          {cfg.size}
                        </p>
                      </div>
                      <p className="text-sm font-bold">฿{cfg.price.toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Shop info */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">ชื่อร้านค้า *</label>
                <input className={inputCls} placeholder="ชื่อร้าน/แบรนด์" value={vendorForm.shop_name}
                  onChange={e => setVendorForm(f => ({ ...f, shop_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">ชื่อผู้ติดต่อ *</label>
                  <input className={inputCls} placeholder="ชื่อ-นามสกุล" value={vendorForm.contact_name}
                    onChange={e => setVendorForm(f => ({ ...f, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">เบอร์โทร *</label>
                  <input className={inputCls} placeholder="08x-xxx-xxxx" type="tel" value={vendorForm.phone}
                    onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">รายละเอียดสินค้า/บริการ</label>
                <textarea rows={3} className={inputCls} placeholder="อธิบายสั้นๆ ว่าจะนำสินค้า/บริการอะไรมาจัดงาน"
                  value={vendorForm.description}
                  onChange={e => setVendorForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Price summary */}
              <div className="bg-zinc-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-900">{BOOTH_CONFIG[vendorForm.booth_type].label}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">ชำระเงินหลังได้รับการอนุมัติ</p>
                </div>
                <p className="text-sm font-bold text-zinc-900">฿{BOOTH_CONFIG[vendorForm.booth_type].price.toLocaleString()}</p>
              </div>

              {vendorError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-[11px] text-red-600">{vendorError}</p>
                </div>
              )}

              <button
                onClick={handleVendorSubmit}
                disabled={vendorSubmitting}
                className="btn-primary w-full py-3.5 text-sm disabled:opacity-40"
              >
                {vendorSubmitting ? "กำลังส่งคำขอ..." : userId ? "ส่งคำขอจองโต๊ะ" : "เข้าสู่ระบบเพื่อจอง"}
              </button>

              {!userId && (
                <p className="text-[11px] text-zinc-400 text-center">
                  ต้องเข้าสู่ระบบก่อนจึงจะจองได้
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Confirm Registration Modal ── */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedEvent(null)} />
          <div className="relative bg-white rounded-t-3xl px-5 py-6">
            <p className="text-[11px] font-semibold text-zinc-400 tracking-widest mb-1">ยืนยันการลงทะเบียน</p>
            <h3 className="text-base font-bold text-zinc-900 mb-1">{selectedEvent.title}</h3>
            <p className="text-[11px] text-zinc-400 mb-4">
              {selectedEvent.location} · {formatDate(selectedEvent.date)} · {selectedEvent.time.slice(0,5)} น.
            </p>
            {[
              ["รูปแบบ", selectedEvent.format ?? "-"],
              ["ที่นั่งคงเหลือ", `${selectedEvent.max_slots - selectedEvent.booked_slots} / ${selectedEvent.max_slots}`],
              ["ค่าสมัคร", "ฟรี"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between mb-2">
                <span className="text-[11px] text-zinc-400">{k}</span>
                <span className="text-[11px] font-semibold text-zinc-900">{v}</span>
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setSelectedEvent(null)} className="btn-outline flex-1 py-3">ยกเลิก</button>
              <button onClick={() => handleRegister(selectedEvent)} disabled={registering}
                className="btn-primary flex-1 py-3 disabled:opacity-40">
                {registering ? "กำลังลงทะเบียน..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal + QR ── */}
      {successEvent && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSuccessEvent(null)} />
          <div className="relative bg-white rounded-t-3xl px-5 py-8 text-center">
            <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L19 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">ลงทะเบียนสำเร็จ!</h3>
            <p className="text-[11px] text-zinc-400 mb-4">{successEvent.title}</p>
            {successQR && (
              <div className="mb-4">
                <MiniQR value={successQR} />
                <p className="text-[10px] text-zinc-400 mt-2">QR Code สำหรับ Check-in วันงาน</p>
                <p className="text-[10px] text-zinc-400">ดู QR ได้อีกครั้งในหน้าโปรไฟล์</p>
              </div>
            )}
            <button onClick={() => setSuccessEvent(null)} className="btn-primary w-full py-3">กลับ</button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
