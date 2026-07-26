"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { TableType, TABLE_TYPE_LABEL } from "@/lib/tradingTables";

type Event = { id: string; title: string; date: string; date_end: string | null; trading_tables_enabled: boolean };

type Booking = {
  id: string;
  user_id: string;
  table_type: TableType;
  table_number: number;
  booking_date: string;
  slot_start: string;
  slot_end: string;
  status: "confirmed" | "cancelled";
  created_at: string;
  username: string;
  displayName: string;
  phone: string | null;
};

function formatThaiDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminTradingTablesPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

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
    async function loadEvents() {
      const { data } = await supabase
        .from("events")
        .select("id, title, date, date_end, trading_tables_enabled")
        .eq("trading_tables_enabled", true)
        .order("date", { ascending: true });
      setEvents(data ?? []);
      if (data && data.length > 0) setEventId(data[0].id);
      else setLoading(false);
    }
    loadEvents();
  }, []);

  const loadBookings = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/trading-tables?event_id=${eventId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setBookings(data.bookings ?? []);
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [eventId, authedFetch]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const days = Array.from(new Set(bookings.map((b) => b.booking_date))).sort();
  const filtered = bookings.filter((b) => {
    if (b.status !== "confirmed") return false;
    if (dateFilter !== "all" && b.booking_date !== dateFilter) return false;
    if (typeFilter !== "all" && b.table_type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {events.length > 1 && (
          <select className="input text-xs w-56" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
        )}
        <div className="flex gap-1.5">
          <button onClick={() => setDateFilter("all")}
            className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold ${dateFilter === "all" ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
            ทุกวัน
          </button>
          {days.map((d) => (
            <button key={d} onClick={() => setDateFilter(d)}
              className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold ${dateFilter === d ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
              {formatThaiDate(d)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setTypeFilter("all")}
            className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold ${typeFilter === "all" ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
            ทุกประเภท
          </button>
          {(["pokemon", "onepiece", "lorcana"] as TableType[]).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold ${typeFilter === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
              {TABLE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <button onClick={loadBookings} className="text-[11px] text-zinc-400 border border-zinc-200 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50">รีเฟรช</button>
        <span className="text-xs text-zinc-400 ml-auto">{filtered.length} การจอง</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-[11px] text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {["วันที่", "เวลา", "ประเภทโต๊ะ", "โต๊ะ", "ผู้จอง", "เบอร์โทร", "จองเมื่อ"].map((h) => (
                <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-zinc-400">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-zinc-400">ยังไม่มีการจอง</td></tr>
            ) : (
              filtered
                .slice()
                .sort((a, b) => (a.booking_date + a.slot_start).localeCompare(b.booking_date + b.slot_start))
                .map((b) => (
                  <tr key={b.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                    <td className="px-5 py-3.5 text-xs text-zinc-700">{formatThaiDate(b.booking_date)}</td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-zinc-900">{b.slot_start.slice(0, 5)}-{b.slot_end.slice(0, 5)}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-700">{TABLE_TYPE_LABEL[b.table_type]}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-700">โต๊ะ {b.table_number}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-semibold text-zinc-900">{b.displayName}</p>
                      <p className="text-[10px] text-zinc-400">@{b.username}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-zinc-600">{b.phone ?? "-"}</td>
                    <td className="px-5 py-3.5 text-[11px] text-zinc-400">
                      {new Date(b.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
