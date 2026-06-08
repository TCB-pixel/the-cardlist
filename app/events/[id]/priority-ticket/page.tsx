"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const PRICE = 690;
const PRICE_CARD = Math.ceil(PRICE * 1.03); // บวก 3% fee
const MAX_TICKETS = 100;
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// ─── Card Payment Form ───
function CardPaymentForm({ clientSecret, onSuccess, onError }: {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement)! },
      });
      if (error) {
        onError(error.message ?? "ชำระเงินไม่สำเร็จ");
      } else if (paymentIntent?.status === "succeeded") {
        onSuccess(paymentIntent.id);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xs space-y-4">
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
        <p className="text-[11px] text-amber-700">💳 ราคานี้รวมค่าธรรมเนียมบัตรเครดิต 3% แล้ว (฿{PRICE} + ฿{PRICE_CARD - PRICE} = ฿{PRICE_CARD})</p>
      </div>
      <div className="border-2 border-zinc-200 rounded-2xl px-4 py-4 bg-white">
        <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mb-2">ข้อมูลบัตร</p>
        <CardElement options={{
          style: {
            base: {
              fontSize: "16px",
              color: "#18181b",
              fontFamily: "sans-serif",
              "::placeholder": { color: "#a1a1aa" },
            },
            invalid: { color: "#ef4444" },
          },
          hidePostalCode: true,
        }} />
      </div>
      <p className="text-[10px] text-zinc-400 text-center">🔒 ข้อมูลบัตรเข้ารหัสและปลอดภัยด้วย Stripe</p>
      <button
        onClick={handleSubmit}
        disabled={loading || !stripe}
        className={`btn-primary w-full py-3.5 text-sm ${loading ? "opacity-50 cursor-not-allowed" : ""}`}>
        {loading ? "กำลังชำระเงิน..." : `ชำระ ฿${PRICE_CARD} (รวม fee 3%)`}
      </button>
    </div>
  );
}

// ─── Main Page ───
export default function PriorityTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"info" | "select" | "promptpay" | "card" | "done">("info");
  const [error, setError] = useState("");
  const [ticketsSold, setTicketsSold] = useState(0);
  const [payLoading, setPayLoading] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(data);
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

  async function handleSelectPayment(method: "promptpay" | "card") {
    setError("");
    setPayLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user ? await supabase.from("profiles").select("email").eq("id", user.id).single() : { data: null };

      const res = await fetch("/api/stripe/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: method === "card" ? PRICE_CARD : PRICE,
          description: `Priority Guest Ticket - ${event?.title ?? "Event"}`,
          paymentMethod: method,
          email: profile?.email ?? user?.email ?? "guest@thecardlist.com",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPaymentIntentId(data.paymentIntentId);

      if (method === "promptpay") {
        setQrImage(data.qrImage);
        setStep("promptpay");
        // Poll
        pollRef.current = setInterval(async () => {
          const s = await fetch(`/api/stripe/charge?paymentIntentId=${data.paymentIntentId}`);
          const sd = await s.json();
          if (sd.status === "succeeded") {
            clearInterval(pollRef.current!);
            await createTicket(data.paymentIntentId);
          } else if (sd.status === "canceled" || sd.status === "requires_payment_method") {
            clearInterval(pollRef.current!);
            setError("การชำระเงินล้มเหลว กรุณาลองใหม่");
          }
        }, 3000);
      } else {
        setClientSecret(data.clientSecret);
        setStep("card");
      }
    } catch (err: any) {
      setError(err.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setPayLoading(false);
    }
  }

  async function createTicket(piId: string) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { router.push("/login"); return; }

    const qrCode = `PG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { error: err } = await supabase.from("event_tickets").insert({
      user_id: user.id,
      event_id: id,
      status: "approved",
      qr_code: qrCode,
      charge_id: piId,
      free_pack_redeemed: false,
      free_pack_quota: 5,
      free_pack_used: 0,
      ma5_slot: null,
    });
    if (err) { setError(err.message); return; }

    const { data: profile } = await supabase
      .from("profiles").select("line_user_id").eq("id", user.id).single();
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
        <div className="bg-zinc-50 rounded-2xl p-4">
          <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mb-1">งาน</p>
          <p className="text-base font-bold text-zinc-900">{event?.title}</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {event?.location} · {event?.date ? new Date(event.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : ""}
          </p>
        </div>
        <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <span className="text-xs font-semibold text-amber-800">บัตรที่เหลือ</span>
          <span className="text-lg font-bold text-amber-700">{remaining} / {MAX_TICKETS}</span>
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-900">Priority Guest Benefits</h2>
            <span className="text-lg font-bold text-zinc-900">฿{PRICE}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-green-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-sm">🎁</span></div>
              <div>
                <p className="text-xs font-semibold text-green-900">Pokemon Booster Pack M2 JP ฟรี</p>
                <p className="text-[10px] text-green-700 mt-0.5">รับได้หน้างาน แสดง QR Code</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-blue-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-sm">🛍️</span></div>
              <div>
                <p className="text-xs font-semibold text-blue-900">สิทธิ์ซื้อ Booster Pack M1-M5 ราคาป้าย 5 ซอง</p>
                <p className="text-[10px] text-blue-700 mt-0.5">จนกว่าของจะหมด</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-zinc-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-sm">🌑</span></div>
              <div>
                <p className="text-xs font-semibold text-zinc-900">ลุ้นซื้อ Booster Box M5A เงามืดคุกคาม ราคาป้าย</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">20 สิทธิ์ สุ่มหน้างาน</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-amber-50 rounded-2xl p-4">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-sm">⚡</span></div>
              <div>
                <p className="text-xs font-semibold text-amber-900">ลุ้นสิทธิ์ซื้อ Pokemon ETB Ascend Heroes ฿2,190</p>
                <p className="text-[10px] text-amber-700 mt-0.5">1 สิทธิ์ สุ่มหน้างาน</p>
              </div>
            </div>
          </div>
        </div>
        {isSoldOut ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-4 text-center">
            <p className="text-sm font-bold text-red-700">บัตรหมดแล้ว</p>
          </div>
        ) : (
          <button onClick={() => setStep("select")}
            className="btn-primary w-full py-3.5 text-sm">
            ซื้อบัตร Priority Guest ฿{PRICE}
          </button>
        )}
        {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3"><p className="text-[11px] text-red-600">{error}</p></div>}
      </div>
      <BottomNav />
    </div>
  );

  // ─── SELECT PAYMENT ───
  if (step === "select") return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
        <button onClick={() => setStep("info")} className="text-zinc-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900">เลือกวิธีชำระเงิน</span>
      </header>
      <div className="px-5 py-6 flex-1 space-y-4">
        <div className="text-center mb-2">
          <p className="text-2xl font-bold text-zinc-900">฿{PRICE}</p>
          <p className="text-xs text-zinc-400 mt-1">Priority Guest — {event?.title}</p>
        </div>

        <button
          onClick={() => handleSelectPayment("promptpay")}
          disabled={payLoading}
          className="w-full border-2 border-zinc-200 hover:border-zinc-900 rounded-2xl p-4 flex items-center gap-4 transition-all disabled:opacity-50">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-xl">📱</span>
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-semibold text-zinc-900">PromptPay</p>
            <p className="text-[11px] text-zinc-400">สแกน QR จ่ายผ่านแอปธนาคาร</p>
          </div>
          <span className="text-sm font-bold text-zinc-900">฿{PRICE}</span>
        </button>

        <button
          onClick={() => handleSelectPayment("card")}
          disabled={payLoading}
          className="w-full border-2 border-zinc-200 hover:border-zinc-900 rounded-2xl p-4 flex items-center gap-4 transition-all disabled:opacity-50">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-xl">💳</span>
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-semibold text-zinc-900">บัตรเครดิต / เดบิต</p>
            <p className="text-[11px] text-zinc-400">Visa, Mastercard, JCB · รวม fee 3%</p>
          </div>
          <span className="text-sm font-bold text-zinc-900">฿{PRICE_CARD}</span>
        </button>

        {payLoading && (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
            <p className="text-xs text-zinc-400">กำลังเตรียมระบบชำระเงิน...</p>
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3"><p className="text-[11px] text-red-600">{error}</p></div>}
      </div>
      <BottomNav />
    </div>
  );

  // ─── PROMPTPAY ───
  if (step === "promptpay") return (
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
            <span className="font-semibold text-zinc-900">฿{PRICE}</span>
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

  // ─── CARD ───
  if (step === "card") return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12">
        <button onClick={() => setStep("select")} className="text-zinc-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900">ชำระด้วยบัตร</span>
      </header>
      <div className="px-5 py-8 flex-1 flex flex-col items-center">
        <div className="text-center mb-6">
          <p className="text-[11px] text-zinc-400 mb-1">ชำระด้วยบัตรเครดิต / เดบิต (รวม fee 3%)</p>
          <p className="text-3xl font-bold text-zinc-900">฿{PRICE_CARD}</p>
          <p className="text-xs text-zinc-400 mt-1">Priority Guest — {event?.title}</p>
        </div>
        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CardPaymentForm
              clientSecret={clientSecret}
              onSuccess={(piId) => createTicket(piId)}
              onError={(msg) => setError(msg)}
            />
          </Elements>
        )}
        {error && <div className="w-full max-w-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-4"><p className="text-[11px] text-red-600">{error}</p></div>}
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
          <span className="text-[11px] font-semibold text-green-700">M2 JP ฟรี + Booster Pack 5 ซอง + ลุ้น 2 รางวัล</span>
        </div>
      </div>
      <button onClick={() => router.push("/profile")} className="btn-primary w-full max-w-xs py-3.5">
        ดู QR Code ในโปรไฟล์ →
      </button>
      <BottomNav />
    </div>
  );
}
