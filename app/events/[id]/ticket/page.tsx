"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

export default function EventTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"info" | "payment" | "done">("info");
  const [slip, setSlip] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [ticketId, setTicketId] = useState("");

  const PROMPTPAY = "0812345678"; // เปลี่ยนเป็นเบอร์จริง
  const PRICE = 150;

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(data);
      setLoading(false);
    }
    load();
  }, [id]);

  function handleSlipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlip(file);
    setSlipPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    if (!slip) { setError("กรุณาอัพโหลดสลิปการโอนเงิน"); return; }
    setError("");
    setUploading(true);

    try {
      const { data: { user: sessionUser }, error: sessionErr } = await supabase.auth.getUser();
      if (sessionErr || !sessionUser) { router.push("/login"); return; }

      // อัพโหลดสลิป
      const ext = slip.name.split(".").pop();
      const fileName = `ticket_${sessionUser.id}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("slips")
        .upload(fileName, slip);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("slips").getPublicUrl(fileName);

      // สร้าง ticket
      const qrCode = `TCK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { data: ticket, error: ticketErr } = await supabase
        .from("event_tickets")
        .insert({
          user_id: sessionUser.id,
          event_id: id,
          status: "pending",
          slip_url: urlData.publicUrl,
          qr_code: qrCode,
          free_pack_redeemed: false,
          free_pack_quota: 5,
          free_pack_used: 0,
        })
        .select()
        .single();

      if (ticketErr) throw ticketErr;
      setTicketId(ticket.id);
      setStep("done");
    } catch (err: any) {
      setError(err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-zinc-400 text-sm">ไม่พบ event นี้</p>
      </div>
    );
  }

  // ─── DONE ───
  if (step === "done") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M6 14l6 6L22 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">ส่งสลิปสำเร็จ!</h2>
        <p className="text-sm text-zinc-400 mb-1">รอ admin ยืนยันการชำระเงิน</p>
        <p className="text-xs text-zinc-400 mb-8">QR Code จะปรากฏในโปรไฟล์หลังจาก admin อนุมัติ</p>

        <div className="bg-zinc-50 rounded-2xl p-4 w-full max-w-xs mb-6 text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-zinc-400">งาน</span>
            <span className="text-[11px] font-semibold text-zinc-900">{event.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[11px] text-zinc-400">บัตร</span>
            <span className="text-[11px] font-semibold text-zinc-900">Special Guest</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[11px] text-zinc-400">ราคา</span>
            <span className="text-[11px] font-semibold text-zinc-900">฿{PRICE}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[11px] text-zinc-400">สิทธิ์ที่ได้</span>
            <span className="text-[11px] font-semibold text-green-700">Pokemon M2 ฟรี 1 ซอง + ซื้อราคาป้าย 5 ซอง</span>
          </div>
        </div>

        <button onClick={() => router.push("/profile")} className="btn-primary px-8 py-3 w-full max-w-xs">
          ดูสถานะในโปรไฟล์
        </button>
        <BottomNav />
      </div>
    );
  }

  // ─── INFO ───
  if (step === "info") {
    return (
      <div className="min-h-screen bg-white flex flex-col pb-20">
        <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
          <button onClick={() => router.back()} className="text-zinc-400">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-sm font-semibold text-zinc-900">บัตรเข้างาน</span>
        </header>

        <div className="px-5 py-6 flex-1">
          {/* Event Info */}
          <div className="bg-zinc-50 rounded-2xl p-4 mb-6">
            <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mb-1">งาน</p>
            <p className="text-base font-bold text-zinc-900">{event.title}</p>
            <p className="text-[11px] text-zinc-400 mt-1">{event.location} · {new Date(event.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>

          {/* Ticket Details */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-zinc-900">บัตร Special Guest</h2>
              <span className="text-lg font-bold text-zinc-900">฿{PRICE}</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-green-50 rounded-2xl p-4">
                <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🎁</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-green-900">Pokemon M2 Booster Pack ฟรี 1 ซอง</p>
                  <p className="text-[10px] text-green-700 mt-0.5">รับได้หน้างาน แสดง QR Code</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-blue-50 rounded-2xl p-4">
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🏷️</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-900">ซื้อ Pokemon Pack ราคาป้าย ได้ 5 ซอง</p>
                  <p className="text-[10px] text-blue-700 mt-0.5">สิทธิ์ต่อคน ใช้ได้วันงานเท่านั้น</p>
                </div>
              </div>
            </div>
          </div>

          <button onClick={() => setStep("payment")} className="btn-primary w-full py-3.5 text-sm">
            ซื้อบัตร Special Guest
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── PAYMENT ───
  return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
        <button onClick={() => setStep("info")} className="text-zinc-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900">ชำระเงิน</span>
      </header>

      <div className="px-5 py-6 flex-1">
        <div className="text-center mb-6">
          <p className="text-[11px] text-zinc-400 mb-1">โอนเงินผ่าน PromptPay</p>
          <p className="text-2xl font-bold text-zinc-900 mb-1">฿{PRICE}.00</p>
          <p className="text-xs text-zinc-400">บัตร Special Guest — {event.title}</p>
        </div>

        {/* PromptPay QR */}
        <div className="bg-zinc-50 rounded-2xl p-5 text-center mb-6">
          <div className="w-40 h-40 bg-white rounded-2xl mx-auto mb-3 flex items-center justify-center border border-zinc-100">
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: 49 }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-sm ${(i + Math.floor(i/7)) % 2 === 0 ? "bg-zinc-900" : "bg-white"}`} />
              ))}
            </div>
          </div>
          <p className="text-xs font-semibold text-zinc-900">PromptPay</p>
          <p className="text-sm font-bold text-zinc-900 mt-0.5">{PROMPTPAY}</p>
          <p className="text-[10px] text-zinc-400 mt-1">The Cardlist</p>
        </div>

        {/* Upload Slip */}
        <div className="mb-5">
          <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-2">
            อัพโหลดสลิปการโอนเงิน <span className="text-red-400">*</span>
          </label>

          {slipPreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-zinc-100 mb-2">
              <Image src={slipPreview} alt="slip" width={400} height={300} className="w-full object-contain max-h-48" />
              <button
                onClick={() => { setSlip(null); setSlipPreview(null); }}
                className="absolute top-2 right-2 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-zinc-500 text-xs"
              >✕</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-2xl py-8 cursor-pointer hover:border-zinc-400 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-zinc-300 mb-2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-xs text-zinc-400">กดเพื่อเลือกรูปสลิป</p>
              <input type="file" accept="image/*" className="hidden" onChange={handleSlipChange} />
            </label>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={uploading || !slip}
          className={`btn-primary w-full py-3.5 text-sm ${(uploading || !slip) ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {uploading ? "กำลังส่ง..." : "ส่งสลิปและยืนยัน"}
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
