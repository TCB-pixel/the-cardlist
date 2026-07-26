"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { TableType, TABLE_TYPES, TABLE_TYPE_LABEL } from "@/lib/tradingTables";

type EventType = "meetup" | "tournament" | "sale";

type Event = {
  id: string;
  title: string;
  location: string;
  date: string;
  date_end: string | null;
  time: string;
  tcg: string;
  format: string | null;
  max_slots: number;
  booked_slots: number;
  description: string | null;
  event_type: EventType;
  image_url: string | null;
  trading_tables_enabled: boolean;
};

const TCG_COLOR: Record<string, string> = {
  "Pokemon": "#EF9F27",
  "One Piece": "#E24B4A",
  "MTG": "#7F77DD",
  "Dragon Ball": "#1D9E75",
  "Mixed": "#6366f1",
  "Other": "#888",
};

const TABS = ["อีเวนต์", "จองโต๊ะ", "จองโต๊ะเทรด"];
const TIME_SLOTS = ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

type TradingSlot = { start: string; end: string };
type TradingBooking = {
  id: string;
  event_id: string;
  user_id: string;
  table_type: TableType;
  table_number: number;
  booking_date: string;
  slot_start: string;
  slot_end: string;
  status: "confirmed" | "cancelled";
};
type TradingData = {
  event: { id: string; title: string; days: string[] };
  slots: TradingSlot[];
  capacity: Record<TableType, number>;
  availability: Record<string, Record<TableType, Record<string, number>>>;
  myBookings: TradingBooking[];
};

function formatThaiDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

export default function EventsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("อีเวนต์");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  // จองโต๊ะ (ที่ร้าน) state
  const [selectedSlot, setSelectedSlot] = useState("");
  const [tableDate, setTableDate] = useState("");
  const [tableDone, setTableDone] = useState(false);

  // จองโต๊ะเทรด state
  const [tradingEventId, setTradingEventId] = useState("");
  const [tradingData, setTradingData] = useState<TradingData | null>(null);
  const [tradingLoading, setTradingLoading] = useState(false);
  const [tradingError, setTradingError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedType, setSelectedType] = useState<TableType>("pokemon");
  const [bookingBusy, setBookingBusy] = useState("");

  // ลงทะเบียนเข้างาน (general_registrations) — กดครั้งเดียวได้ QR เลยจาก list
  const [registrations, setRegistrations] = useState<Record<string, string>>({}); // eventId -> qrCode
  const [registeringId, setRegisteringId] = useState("");
  const [registerError, setRegisterError] = useState("");

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    });
  }, [supabase]);

  useEffect(() => {
    async function load() {
      const [{ data: eventsData }, { data: { session } }] = await Promise.all([
        supabase.from("events").select("*").order("date", { ascending: true }),
        supabase.auth.getSession(),
      ]);
      setEvents(eventsData ?? []);
      setLoggedIn(!!session);
      const firstTrading = (eventsData ?? []).find((e: Event) => e.trading_tables_enabled);
      if (firstTrading) setTradingEventId(firstTrading.id);

      // โหลดสถานะลงทะเบียนเดิมของ user (ถ้า login) เพื่อโชว์ QR ทันทีไม่ต้องกดซ้ำ
      if (session) {
        const { data: regs } = await supabase
          .from("general_registrations")
          .select("event_id, qr_code")
          .eq("user_id", session.user.id);
        const map: Record<string, string> = {};
        (regs ?? []).forEach((r: any) => { map[r.event_id] = r.qr_code; });
        setRegistrations(map);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleRegister(ev: Event) {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setRegisteringId(ev.id);
    setRegisterError("");
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: ev.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลงทะเบียนไม่สำเร็จ");
      setRegistrations((prev) => ({ ...prev, [ev.id]: data.qrCode }));
    } catch (e: any) {
      setRegisterError(e?.message ?? "ลงทะเบียนไม่สำเร็จ");
    } finally {
      setRegisteringId("");
    }
  }

  const loadTradingData = useCallback(async () => {
    if (!tradingEventId) return;
    setTradingLoading(true);
    setTradingError("");
    try {
      const res = await authedFetch(`/api/trading-tables?event_id=${tradingEventId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setTradingData(data);
      setSelectedDate((prev) => prev || (data.event?.days?.[0] ?? ""));
    } catch (e: any) {
      setTradingError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setTradingLoading(false);
    }
  }, [tradingEventId, authedFetch]);

  useEffect(() => {
    if (activeTab === "จองโต๊ะเทรด" && tradingEventId) loadTradingData();
  }, [activeTab, tradingEventId, loadTradingData]);

  async function bookTradingSlot(slot: TradingSlot) {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    if (!window.confirm(`ยืนยันจองโต๊ะ ${TABLE_TYPE_LABEL[selectedType]} วันที่ ${formatThaiDate(selectedDate)} เวลา ${slot.start}-${slot.end} น.?`)) return;

    setBookingBusy(slot.start);
    setTradingError("");
    try {
      const res = await authedFetch("/api/trading-tables", {
        method: "POST",
        body: JSON.stringify({ event_id: tradingEventId, table_type: selectedType, date: selectedDate, slot_start: slot.start }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "จองไม่สำเร็จ");
      await loadTradingData();
    } catch (e: any) {
      setTradingError(e?.message ?? "จองไม่สำเร็จ");
    } finally {
      setBookingBusy("");
    }
  }

  async function cancelTradingBooking(id: string) {
    if (!window.confirm("ยกเลิกการจองรอบนี้?")) return;
    setBookingBusy(id);
    setTradingError("");
    try {
      const res = await authedFetch("/api/trading-tables", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ยกเลิกไม่สำเร็จ");
      await loadTradingData();
    } catch (e: any) {
      setTradingError(e?.message ?? "ยกเลิกไม่สำเร็จ");
    } finally {
      setBookingBusy("");
    }
  }

  function formatDate(date: string, dateEnd: string | null) {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleDateString("th-TH", { month: "short" });
    const year = d.getFullYear();
    if (dateEnd) {
      const de = new Date(dateEnd);
      return `${day}–${de.getDate()} ${month} ${year}`;
    }
    return `${day} ${month} ${year}`;
  }

  function getDayMonth(date: string) {
    const d = new Date(date);
    return {
      day: d.getDate().toString(),
      month: d.toLocaleDateString("th-TH", { month: "short" }).toUpperCase(),
    };
  }

  const tradingEvents = events.filter((e) => e.trading_tables_enabled);

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <TopBar title="Events & Booking" />

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
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-zinc-400">ยังไม่มีอีเวนต์ในขณะนี้</p>
            </div>
          ) : (
            events.map((ev) => {
              const { day, month } = getDayMonth(ev.date);
              const isTournament = ev.event_type === "tournament";
              const pct = ev.max_slots > 0 ? Math.round((ev.booked_slots / ev.max_slots) * 100) : 0;
              const full = isTournament && ev.max_slots > 0 && ev.booked_slots >= ev.max_slots;

              return (
                <div key={ev.id} className="bg-white rounded-2xl overflow-hidden border border-zinc-100">
                  {/* Banner Image — แสดงตามสัดส่วนภาพจริง (16:9) ไม่ครอป */}
                  {ev.image_url && (
                    <div className="relative w-full aspect-[16/9]">
                      <Image src={ev.image_url} alt={ev.title} fill className="object-cover" sizes="100vw" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      {/* Date badge on image */}
                      <div className="absolute top-3 left-3 bg-zinc-900/80 backdrop-blur-sm rounded-xl px-2.5 py-2 text-center min-w-[44px]">
                        <div className="text-lg font-bold text-white leading-none">{day}</div>
                        <div className="text-[8px] text-zinc-300 tracking-wider mt-0.5">{month}</div>
                      </div>
                      {/* Event type badge — เข้าฟรีทั้งหมด */}
                      {ev.event_type !== "tournament" && (
                        <div className="absolute top-3 right-3">
                          <span className="text-[9px] bg-green-500/90 text-white px-2 py-0.5 rounded-full font-semibold backdrop-blur-sm">เข้าฟรี</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="px-4 py-4">
                    {/* No image = show date inline */}
                    {!ev.image_url && (
                      <div className="flex gap-3 items-start mb-3">
                        <div className="bg-zinc-900 rounded-xl px-2.5 py-2 text-center min-w-[44px] flex-shrink-0">
                          <div className="text-lg font-bold text-white leading-none">{day}</div>
                          <div className="text-[8px] text-zinc-400 tracking-wider mt-0.5">{month}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: TCG_COLOR[ev.tcg] ?? "#888" }} />
                            <span className="text-[9px] tracking-wider text-zinc-400 font-semibold">
                              {ev.tcg}{ev.format ? ` · ${ev.format}` : ""}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-zinc-900 leading-snug">{ev.title}</p>
                          <p className="text-[10px] text-zinc-400 mt-1">{ev.location} · {ev.time?.slice(0, 5)} น.</p>
                        </div>
                      </div>
                    )}

                    {/* With image = show title below */}
                    {ev.image_url && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: TCG_COLOR[ev.tcg] ?? "#888" }} />
                          <span className="text-[9px] tracking-wider text-zinc-400 font-semibold">
                            {ev.tcg}{ev.format ? ` · ${ev.format}` : ""}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-zinc-900 leading-snug">{ev.title}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          📍 {ev.location} · 📅 {formatDate(ev.date, ev.date_end)} · 🕐 {ev.time?.slice(0, 5)} น.
                        </p>
                      </div>
                    )}

                    {ev.description && (
                      <p className="text-[11px] text-zinc-500 leading-relaxed mb-3 line-clamp-2">{ev.description}</p>
                    )}

                    {/* Tournament slot bar */}
                    {isTournament && ev.max_slots > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between mb-1.5">
                          <span className="text-[10px] text-zinc-500">
                            ที่นั่ง {full ? "เต็มแล้ว" : `คงเหลือ ${ev.max_slots - ev.booked_slots}`} / {ev.max_slots}
                          </span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-zinc-900"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Meet up — เข้าฟรี */}
                    {!isTournament && (
                      <div className="mb-3">
                        <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
                          <p className="text-xs font-bold text-green-600">เข้างานฟรี ไม่มีค่าใช้จ่าย</p>
                        </div>
                      </div>
                    )}

                    {/* ปุ่มจองโต๊ะเทรด (ถ้าอีเวนต์เปิดใช้งาน) */}
                    {ev.trading_tables_enabled && (
                      <button
                        onClick={() => { setTradingEventId(ev.id); setActiveTab("จองโต๊ะเทรด"); }}
                        className="w-full mb-2 text-center text-xs font-semibold py-2.5 rounded-xl border border-zinc-200 text-zinc-700 active:bg-zinc-50 transition-colors"
                      >
                        🃏 จองโต๊ะเทรดในงานนี้
                      </button>
                    )}

                    {/* CTA: ลงทะเบียน — กดครั้งเดียวได้ QR เลย (ยกเว้น tournament ใช้ระบบที่นั่งแยก) */}
                    {registrations[ev.id] ? (
                      <div className="bg-zinc-50 rounded-xl px-3 py-2.5 border border-zinc-100">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-green-600">✓ ลงทะเบียนแล้ว</p>
                            <p className="text-[10px] text-zinc-400 font-mono truncate">{registrations[ev.id]}</p>
                          </div>
                          <Link href="/profile" className="flex-shrink-0 text-[10px] font-semibold text-zinc-900 border border-zinc-200 rounded-lg px-2.5 py-1.5 active:bg-zinc-100">
                            ดู QR →
                          </Link>
                        </div>
                      </div>
                    ) : full ? (
                      <div className="w-full text-center text-xs font-semibold py-2.5 rounded-xl bg-zinc-100 text-zinc-400">
                        ที่นั่งเต็ม
                      </div>
                    ) : isTournament ? (
                      <Link href={`/events/${ev.id}`}
                        className="block w-full text-center text-xs font-semibold py-2.5 rounded-xl bg-zinc-900 text-white active:opacity-70 transition-opacity">
                        ดูรายละเอียด →
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleRegister(ev)}
                        disabled={registeringId === ev.id}
                        className="block w-full text-center text-xs font-semibold py-2.5 rounded-xl bg-zinc-900 text-white active:opacity-70 transition-opacity disabled:opacity-50"
                      >
                        {registeringId === ev.id ? "กำลังลงทะเบียน..." : "ลงทะเบียน →"}
                      </button>
                    )}
                    {registerError && registeringId === "" && (
                      <p className="text-[10px] text-red-600 mt-1.5">{registerError}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: จองโต๊ะ (ที่ร้าน) ── */}
      {activeTab === "จองโต๊ะ" && (
        <div className="px-4 py-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">จองโต๊ะเล่นการ์ดที่ร้าน</h3>
            <p className="text-[11px] text-zinc-400 mb-4">เปิดให้จองทุกวัน 11:00 – 21:00 น. (สูงสุด 2 ชั่วโมง / ครั้ง)</p>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-600 tracking-wide mb-1.5 block">เลือกวันที่</label>
                <input type="date" className="input text-sm" value={tableDate}
                  onChange={(e) => setTableDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-600 tracking-wide mb-1.5 block">เลือกเวลา</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((t) => (
                    <button key={t} onClick={() => setSelectedSlot(t)}
                      className={`text-xs py-2 rounded-xl border transition-colors ${selectedSlot === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 bg-white"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-600 tracking-wide mb-1.5 block">จำนวนที่นั่ง</label>
                <select className="input text-sm">
                  <option>1 คน</option><option>2 คน</option><option>3 คน</option><option>4 คน</option>
                </select>
              </div>
              {tableDone ? (
                <div className="bg-zinc-50 rounded-2xl p-4 text-center border border-zinc-100">
                  <div className="text-2xl mb-2">✓</div>
                  <p className="text-sm font-semibold text-zinc-900">จองสำเร็จ!</p>
                  <p className="text-[11px] text-zinc-400 mt-1">วันที่ {tableDate} เวลา {selectedSlot} น.</p>
                </div>
              ) : (
                <button onClick={() => tableDate && selectedSlot && setTableDone(true)}
                  disabled={!tableDate || !selectedSlot}
                  className={`w-full py-3 text-sm font-semibold rounded-xl ${tableDate && selectedSlot ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}>
                  ยืนยันการจอง
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: จองโต๊ะเทรด ── */}
      {activeTab === "จองโต๊ะเทรด" && (
        <div className="px-4 py-4 space-y-4">
          {tradingEvents.length === 0 ? (
            <div className="card px-5 py-10 text-center">
              <p className="text-sm text-zinc-400">ยังไม่มีอีเวนต์ที่เปิดให้จองโต๊ะเทรด</p>
            </div>
          ) : (
            <>
              {/* เลือกอีเวนต์ (ถ้ามีมากกว่า 1) */}
              {tradingEvents.length > 1 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {tradingEvents.map((ev) => (
                    <button key={ev.id}
                      onClick={() => { setTradingEventId(ev.id); setSelectedDate(""); setTradingData(null); }}
                      className={`flex-shrink-0 text-[11px] px-3 py-1.5 rounded-full border font-semibold ${tradingEventId === ev.id ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
                      {ev.title}
                    </button>
                  ))}
                </div>
              )}

              {!loggedIn && (
                <div className="card px-4 py-3 bg-amber-50 border-amber-100">
                  <p className="text-[11px] text-amber-700">
                    กรุณา <Link href="/login" className="font-semibold underline">เข้าสู่ระบบ</Link> หรือ{" "}
                    <Link href="/register" className="font-semibold underline">สมัครสมาชิก</Link> ก่อนจองโต๊ะเทรด
                  </p>
                </div>
              )}

              {tradingError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  <p className="text-[11px] text-red-600">{tradingError}</p>
                </div>
              )}

              {tradingLoading || !tradingData ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="card p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-0.5">จองพื้นที่เทรด — {tradingData.event.title}</h3>
                    <p className="text-[11px] text-zinc-400 mb-4">รอบละ 45 นาที เริ่ม 10:00 น. · เว้น 60 นาทีระหว่างรอบของคุณ</p>

                    {/* เลือกวันที่ */}
                    <div className="mb-3">
                      <label className="text-[11px] font-semibold text-zinc-600 tracking-wide mb-1.5 block">วันที่</label>
                      <div className="flex gap-2">
                        {tradingData.event.days.map((d) => (
                          <button key={d} onClick={() => setSelectedDate(d)}
                            className={`text-xs px-3 py-2 rounded-xl border font-semibold ${selectedDate === d ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 bg-white"}`}>
                            {formatThaiDate(d)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* เลือกประเภทโต๊ะ */}
                    <div className="mb-4">
                      <label className="text-[11px] font-semibold text-zinc-600 tracking-wide mb-1.5 block">ประเภทโต๊ะ</label>
                      <div className="flex gap-2 flex-wrap">
                        {TABLE_TYPES.map((t) => (
                          <button key={t} onClick={() => setSelectedType(t)}
                            className={`text-xs px-3 py-2 rounded-xl border font-semibold ${selectedType === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 bg-white"}`}>
                            {TABLE_TYPE_LABEL[t]} <span className="opacity-60">({tradingData.capacity[t]} โต๊ะ)</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Slot grid */}
                    {selectedDate && (
                      <div className="grid grid-cols-3 gap-2">
                        {tradingData.slots.map((s) => {
                          const capacity = tradingData.capacity[selectedType];
                          const booked = tradingData.availability[selectedDate]?.[selectedType]?.[s.start] ?? 0;
                          const remaining = capacity - booked;
                          const full = remaining <= 0;
                          const isPast = new Date(`${selectedDate}T${s.start}`).getTime() <= Date.now();
                          const disabled = full || isPast || !loggedIn || bookingBusy !== "";
                          return (
                            <button
                              key={s.start}
                              disabled={disabled}
                              onClick={() => bookTradingSlot(s)}
                              className={`text-center rounded-xl border px-2 py-2 transition-colors ${
                                full || isPast
                                  ? "bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed"
                                  : "border-zinc-200 text-zinc-700 active:bg-zinc-50"
                              }`}
                            >
                              <p className="text-[11px] font-semibold">{s.start}</p>
                              <p className="text-[9px] mt-0.5">
                                {bookingBusy === s.start ? "..." : isPast ? "ผ่านไปแล้ว" : full ? "เต็ม" : `ว่าง ${remaining}/${capacity}`}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* การจองของฉัน */}
                  {loggedIn && tradingData.myBookings.length > 0 && (
                    <div className="card p-4">
                      <h3 className="text-sm font-semibold text-zinc-900 mb-3">การจองของฉัน</h3>
                      <div className="space-y-2">
                        {tradingData.myBookings
                          .slice()
                          .sort((a, b) => (a.booking_date + a.slot_start).localeCompare(b.booking_date + b.slot_start))
                          .map((b) => {
                            const isPast = new Date(`${b.booking_date}T${b.slot_start}`).getTime() <= Date.now();
                            return (
                              <div key={b.id} className="flex items-center justify-between bg-zinc-50 rounded-xl px-3 py-2.5">
                                <div>
                                  <p className="text-xs font-semibold text-zinc-900">
                                    {TABLE_TYPE_LABEL[b.table_type]} · โต๊ะ {b.table_number}
                                  </p>
                                  <p className="text-[10px] text-zinc-400 mt-0.5">
                                    {formatThaiDate(b.booking_date)} · {b.slot_start.slice(0, 5)}-{b.slot_end.slice(0, 5)} น.
                                  </p>
                                </div>
                                {!isPast && (
                                  <button
                                    onClick={() => cancelTradingBooking(b.id)}
                                    disabled={bookingBusy === b.id}
                                    className="text-[10px] text-red-600 border border-red-100 rounded-lg px-2.5 py-1 active:bg-red-50 disabled:opacity-50"
                                  >
                                    {bookingBusy === b.id ? "..." : "ยกเลิก"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
