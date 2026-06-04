"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

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
};

const TCG_COLOR: Record<string, string> = {
  "Pokemon": "#EF9F27",
  "One Piece": "#E24B4A",
  "MTG": "#7F77DD",
  "Dragon Ball": "#1D9E75",
  "Mixed": "#6366f1",
  "Other": "#888",
};

const TABS = ["อีเวนต์", "จองโต๊ะ"];
const TIME_SLOTS = ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

export default function EventsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("อีเวนต์");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // จองโต๊ะ state
  const [selectedSlot, setSelectedSlot] = useState("");
  const [tableDate, setTableDate] = useState("");
  const [tableDone, setTableDone] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });
      setEvents(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

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
                  {/* Banner Image */}
                  {ev.image_url && (
                    <div className="relative h-36 w-full">
                      <Image src={ev.image_url} alt={ev.title} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      {/* Date badge on image */}
                      <div className="absolute top-3 left-3 bg-zinc-900/80 backdrop-blur-sm rounded-xl px-2.5 py-2 text-center min-w-[44px]">
                        <div className="text-lg font-bold text-white leading-none">{day}</div>
                        <div className="text-[8px] text-zinc-300 tracking-wider mt-0.5">{month}</div>
                      </div>
                      {/* Event type badge */}
                      {ev.event_type !== "tournament" && (
                        <div className="absolute top-3 right-3 flex gap-1">
                          <span className="text-[9px] bg-green-500/90 text-white px-2 py-0.5 rounded-full font-semibold backdrop-blur-sm">ฟรี</span>
                          <span className="text-[9px] bg-amber-500/90 text-white px-2 py-0.5 rounded-full font-semibold backdrop-blur-sm">฿690</span>
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

                    {/* Meet up — ticket preview */}
                    {!isTournament && (
                      <div className="flex gap-2 mb-3">
                        <div className="flex-1 bg-zinc-50 rounded-xl px-3 py-2 text-center">
                          <p className="text-[9px] text-zinc-400 mb-0.5">General</p>
                          <p className="text-xs font-bold text-green-600">ฟรี</p>
                        </div>
                        <div className="flex-1 bg-amber-50 rounded-xl px-3 py-2 text-center">
                          <p className="text-[9px] text-zinc-400 mb-0.5">Priority Guest</p>
                          <p className="text-xs font-bold text-amber-600">฿690</p>
                        </div>
                      </div>
                    )}

                    {/* CTA Button */}
                    {full ? (
                      <div className="w-full text-center text-xs font-semibold py-2.5 rounded-xl bg-zinc-100 text-zinc-400">
                        ที่นั่งเต็ม
                      </div>
                    ) : (
                      <Link href={`/events/${ev.id}`}
                        className="block w-full text-center text-xs font-semibold py-2.5 rounded-xl bg-zinc-900 text-white active:opacity-70 transition-opacity">
                        ลงทะเบียน →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: จองโต๊ะ ── */}
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

      <BottomNav />
    </div>
  );
}
