"use client";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

const EVENTS = [
  { id: "1", day: "26", month: "APR", title: "OP Regional Bangkok", desc: "One Piece TCG Regional Tournament — Swiss Format 8 rounds", location: "สยามพารากอน Hall A", time: "09:00 น.", maxSlots: 128, bookedSlots: 110, tcg: "One Piece", format: "Swiss Format", fee: 300 },
  { id: "2", day: "03", month: "MAY", title: "Pokémon League Cup", desc: "In-Store Pokémon League Cup — Best of 3", location: "The Cardlist Store", time: "13:00 น.", maxSlots: 32, bookedSlots: 12, tcg: "Pokémon", format: "Bo3", fee: 150 },
  { id: "3", day: "10", month: "MAY", title: "MTG Commander Night", desc: "Weekly Commander Format Night — 4-player pods", location: "The Cardlist Store", time: "18:00 น.", maxSlots: 16, bookedSlots: 4, tcg: "MTG", format: "Commander", fee: 100 },
  { id: "4", day: "17", month: "MAY", title: "Dragon Ball SCG Open", desc: "Dragon Ball Super Card Game Open Tournament", location: "The Cardlist Store", time: "13:00 น.", maxSlots: 32, bookedSlots: 0, tcg: "Dragon Ball", format: "Swiss Format", fee: 200 },
];

const TABS = ["อีเวนต์", "จองโต๊ะ"];
const TIME_SLOTS = ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState("อีเวนต์");
  const [selectedEvent, setSelectedEvent] = useState<typeof EVENTS[0] | null>(null);
  const [bookingDone, setBookingDone] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [tableDate, setTableDate] = useState("");
  const [tableDone, setTableDone] = useState(false);

  function handleBook(ev: typeof EVENTS[0]) {
    setSelectedEvent(ev);
  }

  function confirmBook() {
    setBookingDone(true);
  }

  const TCG_COLOR: Record<string, string> = {
    "One Piece": "#E24B4A", "Pokémon": "#EF9F27", "MTG": "#7F77DD", "Dragon Ball": "#1D9E75",
  };

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

      {activeTab === "อีเวนต์" && (
        <div className="px-4 py-4 space-y-3">
          {EVENTS.map((ev) => {
            const pct = Math.round((ev.bookedSlots / ev.maxSlots) * 100);
            const remaining = ev.maxSlots - ev.bookedSlots;
            const full = remaining === 0;
            return (
              <div key={ev.id} className="card overflow-hidden">
                <div className="px-4 py-4">
                  <div className="flex gap-3 items-start">
                    <div className="bg-zinc-900 rounded-xl px-2.5 py-2 text-center min-w-[44px] flex-shrink-0">
                      <div className="text-lg font-bold text-white leading-none">{ev.day}</div>
                      <div className="text-[8px] text-zinc-400 tracking-wider mt-0.5">{ev.month}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: TCG_COLOR[ev.tcg] ?? "#888" }}></span>
                        <span className="text-[9px] tracking-wider text-zinc-400 font-semibold">{ev.tcg} · {ev.format}</span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-900 leading-snug">{ev.title}</p>
                      <p className="text-[10px] text-zinc-400 mt-1">{ev.location} · {ev.time}</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">{ev.desc}</p>

                  <div className="mt-3">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[10px] text-zinc-500">ที่นั่ง {remaining > 0 ? `คงเหลือ ${remaining}` : "เต็มแล้ว"} / {ev.maxSlots}</span>
                      <span className="text-[10px] text-zinc-500">ค่าสมัคร ฿{ev.fee}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-zinc-900"}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>

                  <button
                    onClick={() => !full && handleBook(ev)}
                    disabled={full}
                    className={`mt-3 w-full text-xs font-semibold py-2.5 rounded-xl tracking-wide transition-opacity ${full ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" : "bg-zinc-900 text-white active:opacity-70"}`}>
                    {full ? "ที่นั่งเต็ม" : "ลงทะเบียน"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "จองโต๊ะ" && (
        <div className="px-4 py-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">จองโต๊ะเล่นการ์ดที่ร้าน</h3>
            <p className="text-[11px] text-zinc-400 mb-4">เปิดให้จองทุกวัน 11:00 – 21:00 น. (สูงสุด 2 ชั่วโมง / ครั้ง)</p>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-600 tracking-wide mb-1.5 block">เลือกวันที่</label>
                <input type="date" className="input text-sm" value={tableDate} onChange={(e) => setTableDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
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
                  <option>1 คน</option>
                  <option>2 คน</option>
                  <option>3 คน</option>
                  <option>4 คน</option>
                </select>
              </div>

              {tableDone ? (
                <div className="bg-zinc-50 rounded-2xl p-4 text-center border border-zinc-100">
                  <div className="text-2xl mb-2">✓</div>
                  <p className="text-sm font-semibold text-zinc-900">จองสำเร็จ!</p>
                  <p className="text-[11px] text-zinc-400 mt-1">วันที่ {tableDate} เวลา {selectedSlot} น.</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">QR Code จะส่งไปยังอีเมลของคุณ</p>
                </div>
              ) : (
                <button
                  onClick={() => tableDate && selectedSlot && setTableDone(true)}
                  disabled={!tableDate || !selectedSlot}
                  className={`w-full py-3 text-sm font-semibold rounded-xl tracking-wide ${tableDate && selectedSlot ? "bg-zinc-900 text-white active:opacity-70" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}>
                  ยืนยันการจอง
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Booking Modal */}
      {selectedEvent && !bookingDone && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedEvent(null)} />
          <div className="relative bg-white rounded-t-3xl px-5 py-6">
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">{selectedEvent.title}</h3>
            <p className="text-[11px] text-zinc-400 mb-4">{selectedEvent.location} · {selectedEvent.day} {selectedEvent.month} · {selectedEvent.time}</p>
            <div className="space-y-2.5 mb-5">
              {[["รูปแบบ", selectedEvent.format], ["ค่าสมัคร", `฿${selectedEvent.fee}`], ["ที่นั่งคงเหลือ", `${selectedEvent.maxSlots - selectedEvent.bookedSlots} / ${selectedEvent.maxSlots}`]].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[11px] text-zinc-400">{k}</span>
                  <span className="text-[11px] font-semibold text-zinc-900">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-400 mb-4">* ต้องเข้าสู่ระบบก่อนทำการลงทะเบียน QR Code จะส่งไปยังอีเมลที่ลงทะเบียนไว้</p>
            <div className="flex gap-2">
              <button onClick={() => setSelectedEvent(null)} className="btn-outline flex-1 py-3">ยกเลิก</button>
              <button onClick={confirmBook} className="btn-primary flex-1 py-3">ยืนยันลงทะเบียน</button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Success */}
      {bookingDone && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setBookingDone(false); setSelectedEvent(null); }} />
          <div className="relative bg-white rounded-t-3xl px-5 py-8 text-center">
            <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L19 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">ลงทะเบียนสำเร็จ!</h3>
            <p className="text-xs text-zinc-400 mb-1">{selectedEvent?.title}</p>
            <p className="text-xs text-zinc-400 mb-5">QR Code ส่งไปยังอีเมลของคุณแล้ว</p>
            {/* Mock QR */}
            <div className="w-32 h-32 mx-auto bg-zinc-50 border border-zinc-100 rounded-2xl mb-5 flex items-center justify-center">
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-sm ${Math.random() > 0.5 ? "bg-zinc-900" : "bg-white border border-zinc-100"}`}></div>
                ))}
              </div>
            </div>
            <button onClick={() => { setBookingDone(false); setSelectedEvent(null); }} className="btn-primary w-full py-3">กลับหน้าอีเวนต์</button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
