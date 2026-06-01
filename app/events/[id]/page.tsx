"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [genReg, setGenReg] = useState<any>(null);
  const [priorityTicket, setPriorityTicket] = useState<any>(null);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(ev);

      if (session?.user) {
        const { data: gen } = await supabase
          .from("general_registrations")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("event_id", id)
          .single();
        setGenReg(gen);

        const { data: priority } = await supabase
          .from("priority_tickets")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("event_id", id)
          .single();
        setPriorityTicket(priority);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  async function handleGeneralRegister() {
    if (!user) { router.push("/login"); return; }
    setRegistering(true);
    setError("");
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setGenReg({ qr_code: data.qrCode });
      setSuccess(data.alreadyRegistered ? "คุณลงทะเบียนไปแล้ว!" : "ลงทะเบียนสำเร็จ! ได้รับ QR Code แล้ว");
    } catch (err: any) {
      setError(err.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setRegistering(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

  if (!event) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-zinc-400 text-sm">ไม่พบ event นี้</p>
    </div>
  );

  const eventDate = event.date ? new Date(event.date).toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }) : "";

  return (
    <div className="min-h-screen bg-white flex flex-col pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
        <button onClick={() => router.back()} className="text-zinc-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900 truncate">{event.title}</span>
      </header>

      <div className="px-5 py-5 space-y-5 flex-1">
        {/* Event Header */}
        <div>
          <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mb-1">{event.tcg}</p>
          <h1 className="text-xl font-bold text-zinc-900 leading-snug mb-2">{event.title}</h1>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span>📅</span><span>{eventDate}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span>📍</span><span>{event.location}</span>
            </div>
            {event.time && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span>🕐</span><span>{event.time}</span>
              </div>
            )}
          </div>
          {event.description && (
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{event.description}</p>
          )}
        </div>

        {/* Ticket Options */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 tracking-widest uppercase mb-3">บัตรเข้างาน</p>

          {/* ── General (ฟรี) ── */}
          <div className={`rounded-2xl border p-4 mb-3 ${genReg ? "border-green-200 bg-green-50" : "border-zinc-200 bg-white"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-semibold">GENERAL</span>
                  {genReg && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ ลงทะเบียนแล้ว</span>}
                </div>
                <p className="text-sm font-bold text-zinc-900">ลงทะเบียนฟรี</p>
              </div>
              <span className="text-lg font-bold text-zinc-900">ฟรี</span>
            </div>

            <div className="space-y-1.5 mb-4">
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <span>🏷️</span><span>ซื้อ Pokemon M1/M2/M3/M4/M5 ราคาป้าย</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                <span>⚡</span><span>1 ซอง / คน (จนของหมด)</span>
              </div>
            </div>

            {genReg ? (
              <button onClick={() => router.push("/profile?tab=qr")}
                className="w-full py-2.5 bg-green-600 text-white text-xs font-semibold rounded-xl">
                ดู QR Code ในโปรไฟล์ →
              </button>
            ) : (
              <button onClick={handleGeneralRegister} disabled={registering}
                className={`w-full py-2.5 bg-zinc-900 text-white text-xs font-semibold rounded-xl transition-opacity ${registering ? "opacity-50" : ""}`}>
                {registering ? "กำลังลงทะเบียน..." : "ลงทะเบียนเข้างาน (ฟรี)"}
              </button>
            )}
          </div>

          {/* ── Priority Guest ── */}
          <div className={`rounded-2xl border p-4 ${priorityTicket ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">PRIORITY GUEST</span>
                  {priorityTicket && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ ซื้อแล้ว</span>}
                </div>
                <p className="text-sm font-bold text-zinc-900">Priority Guest Benefits</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">จำกัด 100 ใบเท่านั้น</p>
              </div>
              <span className="text-lg font-bold text-zinc-900">฿500</span>
            </div>

            <div className="space-y-1.5 mb-4">
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <span>🎁</span><span>Pokemon M2 (JP) ฟรี 1 ซอง</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <span>🏷️</span><span>ซื้อ M1/M3/M4 ราคาป้าย 5 ซอง</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <span>🎲</span><span>ลุ้นสิทธิ์ซื้อ MA5 Box ราคาป้าย (24 slots)</span>
              </div>
            </div>

            {priorityTicket ? (
              <button onClick={() => router.push("/profile?tab=qr")}
                className="w-full py-2.5 bg-amber-500 text-white text-xs font-semibold rounded-xl">
                ดู QR Code ในโปรไฟล์ →
              </button>
            ) : (
              <Link href={`/events/${id}/priority-ticket`}
                className="block w-full py-2.5 bg-zinc-900 text-white text-xs font-semibold rounded-xl text-center">
                ซื้อบัตร Priority Guest →
              </Link>
            )}
          </div>
        </div>

        {/* Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-[11px] text-green-700 font-semibold">{success}</p>
            <p className="text-[10px] text-green-600 mt-1">QR Code พร้อมในแท็บ QR ในโปรไฟล์แล้วครับ</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        )}

        {/* Login prompt */}
        {!user && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-4 text-center">
            <p className="text-xs text-zinc-500 mb-3">เข้าสู่ระบบเพื่อลงทะเบียนและรับ QR Code</p>
            <button onClick={() => router.push("/login")}
              className="btn-primary px-6 py-2.5 text-xs">
              เข้าสู่ระบบ / สมัครสมาชิก
            </button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
