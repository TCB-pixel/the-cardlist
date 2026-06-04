"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

const PRICE = 690;
const MAX_TICKETS = 100;

export default function PriorityTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"info" | "payment" | "done">("info");
  const [error, setError] = useState("");
  const [ticketsSold, setTicketsSold] = useState(0);

  // Omise
  const [payLoading, setPayLoading] = useState(false);
  const [chargeId, setChargeId] = useState("");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [payStatus, setPayStatus] = useState<"pending" | "successful" | "failed">("pending");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(data);

      // นับบัตรที่ขายไปแล้ว
      const { count } = await supabase
        .from("event_tickets")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id)
        .neq("status", "rejected");
      setTicketsSold(count ?? 0);
      setLoading(false);
    }
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  async function handleCreateCharge() {
    setError("");
    setPayLoading(true);
    try {
      const res = await fetch("/api/omise/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: PRICE,
          description: `Priority Guest Ticket - ${event?.title ?? "Event"}`,
          sourceType: "promptpay",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setChargeId(data.chargeId);
      setQrImage(data.qrImage);
      setStep("payment");

      // Poll ทุก 3 วินาที
      pollRef.current = setInterval(async () => {
        const statusRes = await fetch(`/api/omise/charge?chargeId=${data.chargeId}`);
        const statusData = await statusRes.json();
        if (statusData.status === "successful") {
          clearInterval(pollRef.current!);
          await createTicket(data.chargeId);
        } else if (statusData.status === "failed") {
          clearInterval(pollRef.current!);
          setPayStatus("failed");
          setError("การชำระเงินล้มเหลว กรุณาลองใหม่");
        }
      }, 3000);

    } catch (err: any) {
      setError(err.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setPayLoading(false);
    }
  }

  async function createTicket(chargeIdParam: string) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { router.push("/login"); return; }

    const qrCode = `PG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { error: err } = await supabase.from("event_tickets").insert({
      user_id: user.id,
      event_id: id,
      status: "approved", // auto approve เพราะ Omise verify แล้ว
      qr_code: qrCode,
      charge_id: chargeIdParam,
      free_pack_redeemed: false,
      free_pack_quota: 5,
      free_pack_used: 0,
      ma5_slot: null, // จะ assign ตอน scan หน้างาน
    });

    if (err) { setError(err.message); return; }

    // ส่ง LINE แจ้งเตือน
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
          type: "ticket_approved",
          data: { eventTitle: event?.title ?? "งาน", qrCode },
        }),
      });
    }

    setPayStatus("successful");
    setStep("done");
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

  const remaining = MAX_TICKETS - ticketsSold;
  const isSoldOut = remaining <= 0;

  // ─── INFO ───
  if (step === "info") return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
        <button onClick={() => router.back()} className="text-zinc-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900">บัตร Priority Guest</span>
      </header>

      <div className="px-5 py-6 flex-1 space-y-5">
        {/* Event Info */}
        <div className="bg-zinc-50 rounded-2xl p-4">
          <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mb-1">งาน</p>
          <p className="text-base font-bold text-zinc-900">{event?.title}</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {event?.location} · {event?.date ? new Date(event.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : ""}
          </p>
        </div>

        {/* Sold counter */}
        <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <span className="text-xs font-semibold text-amber-800">บัตรที่เหลือ</span>
          <span className="text-lg font-bold text-amber-700">{remaining} / {MAX_TICKETS}</span>
        </div>

        {/* Benefits */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-900">Priority Guest Benefits</h2>
            <span className="text-lg font-bold text-zinc-900">฿{PRICE}</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-green-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🎁</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-green-900">🎁 Pokemon Booster Pack M2 JP ฟรี</p>
                <p className="text-[10px] text-green-700 mt-0.5">รับได้หน้างาน แสดง QR Code</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-blue-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🌑</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-900">ลุ้นสิทธิ์ซื้อ Booster Box เงามืดคุกคาม ราคา MSRP</p>
                <p className="text-[10px] text-blue-700 mt-0.5">20 สิทธิ์ จาก 100 คน สุ่มหน้างาน</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-amber-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm">⚡</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-900">ลุ้นสิทธิ์ซื้อ Ascend Heroes ETB ฿2,190</p>
                <p className="text-[10px] text-amber-700 mt-0.5">1 รางวัล สุ่มหน้างาน</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-indigo-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🔵</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-900">ลุ้นสิทธิ์ซื้อ M5 Abyss Eye ฿1,490</p>
                <p className="text-[10px] text-indigo-700 mt-0.5">1 รางวัล สุ่มหน้างาน</p>
              </div>
            </div>
          </div>
        </div>

        {isSoldOut ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-4 text-center">
            <p className="text-sm font-bold text-red-700">บัตรหมดแล้ว</p>
          </div>
        ) : (
          <button onClick={handleCreateCharge} disabled={payLoading}
            className={`btn-primary w-full py-3.5 text-sm ${payLoading ? "opacity-50 cursor-not-allowed" : ""}`}>
            {payLoading ? "กำลังสร้าง QR..." : `ซื้อบัตร Priority Guest ฿${PRICE}`}
          </button>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );

  // ─── PAYMENT ───
  if (step === "payment") return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
        <span className="text-sm font-semibold text-zinc-900">สแกนจ่าย PromptPay</span>
      </header>

      <div className="px-5 py-8 flex-1 flex flex-col items-center">
        <div className="text-center mb-6">
          <p className="text-[11px] text-zinc-400 mb-1">ชำระผ่าน PromptPay</p>
          <p className="text-3xl font-bold text-zinc-900">฿{PRICE}</p>
          <p className="text-xs text-zinc-400 mt-1">Priority Guest — {event?.title}</p>
        </div>

        {/* QR จาก Omise */}
        <div className="bg-white border-2 border-zinc-100 rounded-3xl p-6 mb-6 w-full max-w-xs">
          {qrImage ? (
            <Image src={qrImage} alt="PromptPay QR" width={240} height={240} className="w-full" unoptimized />
          ) : (
            <div className="w-full aspect-square bg-zinc-100 rounded-2xl animate-pulse" />
          )}
          <p className="text-center text-[11px] text-zinc-400 mt-3">สแกนด้วยแอปธนาคารหรือ Wallet</p>
        </div>

        <div className="w-full max-w-xs bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <p className="text-xs font-semibold text-amber-800">รอการชำระเงิน...</p>
          </div>
          <p className="text-[10px] text-amber-600">ระบบจะอัพเดทอัตโนมัติหลังจ่ายเสร็จ</p>
        </div>

        {error && (
          <div className="w-full max-w-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        )}

        <div className="w-full max-w-xs bg-zinc-50 rounded-2xl p-3 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-400">บัตร</span>
            <span className="font-semibold text-zinc-900">Priority Guest</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-400">ยอดชำระ</span>
            <span className="font-semibold text-zinc-900">฿{PRICE}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-400">Charge ID</span>
            <span className="font-mono text-zinc-500 text-[9px]">{chargeId.slice(0, 16)}...</span>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  // ─── DONE ───
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
      <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M6 14l6 6L22 8" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="text-lg font-bold text-zinc-900 mb-2">ชำระเงินสำเร็จ!</h2>
      <p className="text-sm text-zinc-400 mb-6">QR Code บัตรของคุณพร้อมแล้ว</p>

      <div className="bg-zinc-50 rounded-2xl p-4 w-full max-w-xs mb-6 text-left space-y-2">
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">งาน</span>
          <span className="text-[11px] font-semibold text-zinc-900">{event?.title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">บัตร</span>
          <span className="text-[11px] font-semibold text-zinc-900">Priority Guest</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">สิทธิ์</span>
          <span className="text-[11px] font-semibold text-green-700">Booster Pack M1-M5 ฟรี 5 ซอง + ลุ้น 3 รางวัล</span>
        </div>
      </div>

      <button onClick={() => router.push("/profile")} className="btn-primary w-full max-w-xs py-3.5">
        ดู QR Code ในโปรไฟล์ →
      </button>
      <BottomNav />
    </div>
  );
}
