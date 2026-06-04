"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

export default function EventTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(data);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleRegister() {
    setError("");
    setRegistering(true);
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { router.push("/login"); return; }

      // เช็คว่าลงทะเบียนแล้วหรือยัง
      const { data: existing } = await supabase
        .from("general_registrations")
        .select("id, qr_code")
        .eq("user_id", user.id)
        .eq("event_id", id)
        .single();

      if (existing) {
        setQrCode(existing.qr_code);
        setDone(true);
        return;
      }

      // สร้าง QR ใหม่
      const newQr = `GEN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { error: insertErr } = await supabase
        .from("general_registrations")
        .insert({
          user_id: user.id,
          event_id: id,
          qr_code: newQr,
          pack_used: 0,
        });

      if (insertErr) throw insertErr;

      // ส่ง LINE notify
      const { data: profile } = await supabase
        .from("profiles")
        .select("line_user_id, display_name")
        .eq("id", user.id)
        .single();

      if (profile?.line_user_id) {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId: profile.line_user_id,
            type: "broadcast",
            data: {
              message: `✅ ลงทะเบียนเข้างานสำเร็จ!\n\n📍 งาน: ${event?.title ?? "งาน"}\n\n🎫 QR Code: ${newQr}\n\nแสดง QR Code หน้างานได้เลยครับ 🙌`,
            },
          }),
        });
      }

      setQrCode(newQr);
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setRegistering(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

  // ─── DONE ───
  if (done) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
      <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M6 14l6 6L22 8" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="text-lg font-bold text-zinc-900 mb-2">ลงทะเบียนสำเร็จ!</h2>
      <p className="text-sm text-zinc-400 mb-6">QR Code พร้อมใช้งานแล้ว</p>

      <div className="bg-zinc-50 rounded-2xl p-4 w-full max-w-xs mb-6 text-left space-y-2">
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">งาน</span>
          <span className="text-[11px] font-semibold text-zinc-900">{event?.title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">บัตร</span>
          <span className="text-[11px] font-semibold text-zinc-900">General (ฟรี)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">QR Code</span>
          <span className="text-[11px] font-mono text-zinc-600">{qrCode}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">สิทธิ์</span>
          <span className="text-[11px] font-semibold text-green-700">ซื้อ Pack ราคาป้าย 1 ซอง + ลุ้น Booster Box</span>
        </div>
      </div>

      <button onClick={() => router.push("/profile")} className="btn-primary w-full max-w-xs py-3.5">
        ดู QR Code ในโปรไฟล์ →
      </button>
      <BottomNav />
    </div>
  );

  // ─── INFO ───
  return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
        <button onClick={() => router.back()} className="text-zinc-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900">ลงทะเบียนเข้างาน</span>
      </header>

      <div className="px-5 py-6 flex-1">
        <div className="bg-zinc-50 rounded-2xl p-4 mb-6">
          <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mb-1">งาน</p>
          <p className="text-base font-bold text-zinc-900">{event?.title}</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {event?.location} · {event?.date ? new Date(event.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : ""}
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-900">บัตร General</h2>
            <span className="text-lg font-bold text-green-600">ฟรี</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-green-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm">✅</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-green-900">เข้างานได้ไม่จำกัด</p>
                <p className="text-[10px] text-green-700 mt-0.5">แสดง QR Code ที่หน้างาน</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-blue-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🛍️</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-900">รับสิทธิ์ซื้อ Pokemon Pack ราคาป้าย 1 ซอง/คน</p>
                <p className="text-[10px] text-blue-700 mt-0.5">สิทธิ์ต่อคน ใช้ได้วันงานเท่านั้น</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-zinc-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🌑</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-900">ลุ้นสิทธิ์ซื้อ Booster Box เงามืดคุกคาม ราคา MSRP</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">5 สิทธิ์ จาก General ทั้งหมด สุ่มหน้างาน</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={registering}
          className={`btn-primary w-full py-3.5 text-sm ${registering ? "opacity-50 cursor-not-allowed" : ""}`}>
          {registering ? "กำลังลงทะเบียน..." : "ลงทะเบียนฟรี →"}
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
