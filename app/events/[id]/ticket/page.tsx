"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

const PACK_PRICE = 49;

export default function EventTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"info" | "done" | "pack" | "qr" | "complete">("info");
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [regId, setRegId] = useState("");

  // Stripe PromptPay
  const [payLoading, setPayLoading] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(data);
      setLoading(false);
    }
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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
        .select("id, qr_code, pack_paid")
        .eq("user_id", user.id)
        .eq("event_id", id)
        .single();

      if (existing) {
        setQrCode(existing.qr_code);
        setRegId(existing.id);
        setStep("done");
        return;
      }

      // สร้าง QR ใหม่
      const newQr = `GEN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { data: inserted, error: insertErr } = await supabase
        .from("general_registrations")
        .insert({
          user_id: user.id,
          event_id: id,
          qr_code: newQr,
          pack_used: 0,
          pack_paid: false,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      // ส่ง LINE notify
      const { data: profile } = await supabase
        .from("profiles")
        .select("line_user_id")
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
      setRegId(inserted.id);
      setStep("done");
    } catch (err: any) {
      setError(err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setRegistering(false);
    }
  }

  async function handleBuyPack() {
    setError("");
    setPayLoading(true);
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { router.push("/login"); return; }

      let activeRegId = regId;
      if (!activeRegId) {
        const { data: existing, error: regErr } = await supabase
          .from("general_registrations")
          .select("id")
          .eq("user_id", user.id)
          .eq("event_id", id)
          .single();

        if (regErr || !existing?.id) throw new Error("ไม่พบข้อมูลการลงทะเบียน กรุณาลงทะเบียนใหม่อีกครั้ง");
        activeRegId = existing.id;
        setRegId(existing.id);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();

      const res = await fetch("/api/stripe/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: PACK_PRICE,
          description: `General Pack - ${event?.title ?? "Event"}`,
          paymentMethod: "promptpay",
          email: profile?.email ?? user.email ?? "guest@thecardlist.com",

          // สำคัญ: webhook จะใช้ metadata นี้ในการผูก payment กับ general_registrations
          metadata: {
            type: "general_pack",
            user_id: user.id,
            reg_id: activeRegId,
            event_id: id,
          },

          // เผื่อ endpoint เก่ายังอ่าน field แบบเดิม
          userId: user.id,
          eventId: id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPaymentIntentId(data.paymentIntentId);
      setQrImage(data.qrImage);
      setStep("qr");

      pollRef.current = setInterval(async () => {
        const s = await fetch(`/api/stripe/charge?paymentIntentId=${data.paymentIntentId}`);
        const sd = await s.json();
        if (sd.status === "succeeded") {
          clearInterval(pollRef.current!);
          // DB และ LINE notify ให้ webhook เป็นตัวจัดการหลัก เพื่อกันปัญหาผู้ใช้ปิดหน้าก่อน poll ทำงาน
          setStep("complete");
        } else if (sd.status === "canceled" || sd.status === "requires_payment_method") {
          clearInterval(pollRef.current!);
          setError("การชำระเงินล้มเหลว กรุณาลองใหม่");
          setStep("pack");
        }
      }, 3000);
    } catch (err: any) {
      setError(err?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setPayLoading(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

  // ─── DONE — เลือกซื้อซองหรือไม่ ───
  if (step === "done") return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
      <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M6 14l6 6L22 8" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">ลงทะเบียนสำเร็จ!</h2>
      <p className="text-xs text-zinc-400 mb-6">QR Code: <span className="font-mono">{qrCode}</span></p>

      <div className="w-full max-w-xs space-y-3 mb-6">
        <p className="text-sm font-semibold text-zinc-700 text-left">ต้องการใช้สิทธิ์ซื้อ Booster Pack ราคาป้ายตอนนี้ไหม?</p>

        <button
          onClick={() => setStep("pack")}
          className="w-full border-2 border-zinc-900 rounded-2xl p-4 flex items-center gap-4 hover:bg-zinc-50 transition-all">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🛍️</span>
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-semibold text-zinc-900">ซื้อ Booster Pack ราคาป้าย</p>
            <p className="text-[11px] text-zinc-400">จ่าย ฿49 ผ่าน PromptPay ตอนนี้เลย</p>
          </div>
          <span className="text-sm font-bold text-zinc-900">฿49</span>
        </button>

        <button
          onClick={() => router.push("/profile")}
          className="w-full border border-zinc-200 rounded-2xl p-4 flex items-center gap-4 hover:bg-zinc-50 transition-all">
          <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-xl">⏭️</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-700">ไม่ซื้อตอนนี้</p>
            <p className="text-[11px] text-zinc-400">ยังซื้อได้หน้างานวันจริง</p>
          </div>
        </button>
      </div>
      <BottomNav />
    </div>
  );

  // ─── PACK — ยืนยันซื้อ ───
  if (step === "pack") return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
        <button onClick={() => setStep("done")} className="text-zinc-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900">ซื้อ Booster Pack ราคาป้าย</span>
      </header>
      <div className="px-5 py-6 flex-1 space-y-4">
        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-sm font-bold text-blue-900">🛍️ Pokemon Booster Pack ราคาป้าย 1 ซอง</p>
          <p className="text-[11px] text-blue-700 mt-1">รับหน้างาน แสดง QR Code ที่ Staff</p>
        </div>
        <div className="bg-zinc-50 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-400">งาน</span>
            <span className="font-semibold text-zinc-900">{event?.title}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-400">สินค้า</span>
            <span className="font-semibold text-zinc-900">Booster Pack ราคาป้าย 1 ซอง</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span className="text-zinc-700">ยอดชำระ</span>
            <span className="text-zinc-900">฿{PACK_PRICE}</span>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3"><p className="text-[11px] text-red-600">{error}</p></div>}

        <button
          onClick={handleBuyPack}
          disabled={payLoading}
          className={`btn-primary w-full py-3.5 text-sm ${payLoading ? "opacity-50 cursor-not-allowed" : ""}`}>
          {payLoading ? "กำลังสร้าง QR..." : `จ่าย ฿${PACK_PRICE} ผ่าน PromptPay`}
        </button>
      </div>
      <BottomNav />
    </div>
  );

  // ─── QR PromptPay ───
  if (step === "qr") return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
        <span className="text-sm font-semibold text-zinc-900">สแกนจ่าย PromptPay</span>
      </header>
      <div className="px-5 py-8 flex-1 flex flex-col items-center">
        <div className="text-center mb-6">
          <p className="text-[11px] text-zinc-400 mb-1">ชำระผ่าน PromptPay</p>
          <p className="text-3xl font-bold text-zinc-900">฿{PACK_PRICE}</p>
          <p className="text-xs text-zinc-400 mt-1">Booster Pack ราคาป้าย — {event?.title}</p>
        </div>
        <div className="bg-white border-2 border-zinc-100 rounded-3xl p-6 mb-6 w-full max-w-xs">
          {qrImage ? (
            <Image src={qrImage} alt="PromptPay QR" width={240} height={240} className="w-full" unoptimized />
          ) : (
            <div className="w-full aspect-square bg-zinc-100 rounded-2xl animate-pulse" />
          )}
          <p className="text-center text-[11px] text-zinc-400 mt-3">สแกนด้วยแอปธนาคารหรือ Wallet</p>
        </div>
        <div className="w-full max-w-xs bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <p className="text-xs font-semibold text-amber-800">รอการชำระเงิน...</p>
          </div>
          <p className="text-[10px] text-amber-600">ระบบจะอัพเดทอัตโนมัติหลังจ่ายเสร็จ</p>
        </div>
        {error && <div className="w-full max-w-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4"><p className="text-[11px] text-red-600">{error}</p></div>}
        <div className="w-full max-w-xs bg-zinc-50 rounded-2xl p-3 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-400">ยอดชำระ</span>
            <span className="font-semibold text-zinc-900">฿{PACK_PRICE}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-400">Payment ID</span>
            <span className="font-mono text-zinc-500 text-[9px]">{paymentIntentId.slice(0, 16)}...</span>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  // ─── COMPLETE ───
  if (step === "complete") return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
      <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M6 14l6 6L22 8" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="text-lg font-bold text-zinc-900 mb-2">ชำระเงินสำเร็จ!</h2>
      <p className="text-sm text-zinc-400 mb-6">สิทธิ์ซื้อ Booster Pack ราคาป้าย 1 ซองพร้อมแล้ว</p>
      <div className="bg-zinc-50 rounded-2xl p-4 w-full max-w-xs mb-6 text-left space-y-2">
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">งาน</span>
          <span className="text-[11px] font-semibold text-zinc-900">{event?.title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">สิทธิ์</span>
          <span className="text-[11px] font-semibold text-green-700">🛍️ Booster Pack ราคาป้าย 1 ซอง ✅</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">วิธีรับ</span>
          <span className="text-[11px] text-zinc-600">แสดง QR Code หน้างาน</span>
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
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-sm">✅</span></div>
              <div>
                <p className="text-xs font-semibold text-green-900">เข้างานได้ไม่จำกัด</p>
                <p className="text-[10px] text-green-700 mt-0.5">แสดง QR Code ที่หน้างาน</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-blue-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-sm">🛍️</span></div>
              <div>
                <p className="text-xs font-semibold text-blue-900">สิทธิ์ซื้อ Booster Pack M1-M5 ราคาป้าย 1 ซอง</p>
                <p className="text-[10px] text-blue-700 mt-0.5">ชำระ ฿49 ล่วงหน้า หรือซื้อหน้างาน</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-zinc-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-sm">🌑</span></div>
              <div>
                <p className="text-xs font-semibold text-zinc-900">ลุ้นสิทธิ์ซื้อ Booster Box เงามืดคุกคาม ราคา MSRP</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">5 สิทธิ์ สุ่มหน้างาน</p>
              </div>
            </div>
          </div>
        </div>
        {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4"><p className="text-[11px] text-red-600">{error}</p></div>}
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
