"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

const MAX_PRIORITY = 100;

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [genReg, setGenReg] = useState<any>(null);
  const [priorityTicket, setPriorityTicket] = useState<any>(null);
  const [ticketsSold, setTicketsSold] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(ev);

      const { count } = await supabase
        .from("event_tickets")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id)
        .neq("status", "rejected");
      setTicketsSold(count ?? 0);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser ?? null);

      if (currentUser) {
        const { data: gen } = await supabase
          .from("general_registrations")
          .select("*")
          .eq("user_id", currentUser.id)
          .eq("event_id", id)
          .single();
        setGenReg(gen);

        const { data: priority } = await supabase
          .from("event_tickets")
          .select("*")
          .eq("user_id", currentUser.id)
          .eq("event_id", id)
          .single();
        setPriorityTicket(priority);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

  const remaining = MAX_PRIORITY - ticketsSold;
  const prioritySoldOut = remaining <= 0;

  return (
    <div className="min-h-screen bg-white flex flex-col pb-24">

      {/* Banner */}
      {event?.image_url && (
        <div className="relative w-full h-48">
          <Image src={event.image_url} alt={event.title} fill className="object-cover" />
        </div>
      )}

      <div className="px-5 py-5 flex-1 space-y-5">

        {/* Event Info */}
        <div>
          <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mb-1">{event?.category ?? "งาน"}</p>
          <h1 className="text-lg font-bold text-zinc-900">{event?.title}</h1>
          <p className="text-[11px] text-zinc-400 mt-1">
            📍 {event?.location} · {event?.date ? new Date(event.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : ""}
          </p>
          {event?.description && (
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{event.description}</p>
          )}
        </div>

        {/* ─── GENERAL TICKET ─── */}
        <div className="border border-zinc-100 rounded-2xl overflow-hidden">
          <div className="bg-zinc-50 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-zinc-900">General</p>
              <p className="text-[10px] text-zinc-400">ลงทะเบียนฟรี เข้างานได้ทันที</p>
            </div>
            <span className="text-sm font-bold text-green-600">ฟรี</span>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] text-zinc-600">
              <span>✅</span><span>เข้างานได้ไม่จำกัด</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-600">
              <span>🛍️</span><span>สิทธิ์ซื้อ Pokemon Booster Pack M1-M5 ราคาป้าย 1 ซอง จนกว่าของจะหมด</span>
            </div>
          </div>
          <div className="px-4 pb-4">
            {genReg ? (
              <div className="bg-green-50 rounded-xl px-4 py-2.5 text-center">
                <p className="text-xs font-semibold text-green-700">✅ ลงทะเบียนแล้ว</p>
              </div>
            ) : (
              <button
                onClick={() => user ? router.push(`/events/${id}/ticket`) : router.push("/login")}
                className="w-full bg-zinc-900 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-zinc-800 transition-colors">
                ลงทะเบียน General (ฟรี)
              </button>
            )}
          </div>
        </div>

        {/* ─── PRIORITY GUEST ─── */}
        <div className="border border-amber-200 rounded-2xl overflow-hidden">
          <div className="bg-amber-50 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-zinc-900">Priority Guest</p>
              <p className="text-[10px] text-zinc-400">จำกัด {MAX_PRIORITY} ใบ · เหลือ {remaining} ใบ</p>
            </div>
            <span className="text-sm font-bold text-amber-600">฿690</span>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] text-zinc-600">
              <span>🎁</span><span>Pokemon Booster Pack M2 JP ฟรี</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-600">
              <span>🛍️</span><span>สิทธิ์ซื้อ Pokemon Booster Pack M1-M5 ราคาป้าย 5 ซอง จนกว่าของจะหมด</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-600">
              <span>🌑</span><span>ลุ้นซื้อ Pokemon Booster Box M5A เงามืดคุกคาม ราคาป้าย (20 สิทธิ์)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-600">
              <span>⚡</span><span>ลุ้นสิทธิ์ซื้อ Pokemon ETB Ascend Heroes ราคา ฿2,190 (1 สิทธิ์)</span>
            </div>
          </div>
          <div className="px-4 pb-4">
            {priorityTicket ? (
              <div className="bg-amber-50 rounded-xl px-4 py-2.5 text-center">
                <p className="text-xs font-semibold text-amber-700">✅ ซื้อบัตรแล้ว ({priorityTicket.status === "approved" ? "อนุมัติแล้ว" : "รอยืนยัน"})</p>
              </div>
            ) : prioritySoldOut ? (
              <div className="bg-red-50 rounded-xl px-4 py-2.5 text-center">
                <p className="text-xs font-semibold text-red-700">บัตรหมดแล้ว</p>
              </div>
            ) : (
              <button
                onClick={() => user ? router.push(`/events/${id}/priority-ticket`) : router.push("/login")}
                className="w-full bg-amber-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-amber-600 transition-colors">
                ซื้อบัตร Priority Guest ฿690
              </button>
            )}
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}
