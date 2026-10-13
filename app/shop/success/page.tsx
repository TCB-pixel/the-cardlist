"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

type SessionInfo = { amount_total: number | null; customer_email: string | null; payment_status: string };

// หลังกลับจาก Stripe: แสดงตามสถานะจริงของการชำระเงิน ไม่บอกว่า "สำเร็จ" ก่อนได้รับเงินจริง
// PromptPay บางครั้งยืนยันช้า จึงถามซ้ำสักพักก่อนสรุป
function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<"checking" | "paid" | "pending" | "error">("checking");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!sessionId) { router.push("/shop"); return; }
    let stop = false;
    (async () => {
      try {
        const res = await fetch(`/api/stripe/checkout?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const data = await res.json();
        if (stop) return;
        if (!res.ok) throw new Error("bad");
        setSession(data);
        if (data.payment_status === "paid" || data.payment_status === "no_payment_required") {
          setState("paid");
          // ล้างตะกร้าเมื่อได้รับเงินแล้วเท่านั้น (ยกเลิกกลางทางตะกร้ายังอยู่)
          try { localStorage.removeItem("cardlist_cart"); } catch { /* ignore */ }
        } else {
          setState("pending");
          if (tries < 15) setTimeout(() => !stop && setTries((t) => t + 1), 4000);
        }
      } catch {
        if (!stop) setState("error");
      }
    })();
    return () => { stop = true; };
  }, [sessionId, tries, router]);

  if (state === "checking") return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      <p className="text-sm text-zinc-500">กำลังตรวจสอบการชำระเงิน...</p>
    </div>
  );

  const paid = state === "paid";

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${paid ? "bg-green-50" : "bg-amber-50"}`}>
        {paid ? (
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <path d="M8 18l7 7L28 10" stroke="#15803d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <span className="text-3xl" aria-hidden="true">⏳</span>
        )}
      </div>

      <h1 className="text-xl font-bold text-zinc-900 mb-2" role="status">
        {paid ? "ชำระเงินสำเร็จ!" : state === "pending" ? "รอยืนยันการชำระเงิน" : "ตรวจสอบสถานะการชำระเงินไม่ได้"}
      </h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-xs">
        {paid
          ? "ขอบคุณที่สั่งซื้อกับ The Cardlist 🙌"
          : state === "pending"
            ? tries >= 15
              ? "ยังไม่ได้รับการยืนยันจากธนาคาร ถ้าชำระแล้ว คำสั่งซื้อจะขึ้นในประวัติภายในไม่กี่นาที ถ้าไม่ขึ้นโปรดติดต่อทีมงาน"
              : "ถ้าชำระผ่าน PromptPay แล้ว ระบบกำลังรอยืนยันจากธนาคาร ใช้เวลาไม่นาน"
            : "เชื่อมต่อไม่สำเร็จ ตรวจสอบคำสั่งซื้อได้ที่หน้าประวัติการสั่งซื้อ หรือรีเฟรชหน้านี้อีกครั้ง"}
      </p>

      {session && (
        <div className="bg-zinc-50 rounded-2xl p-4 w-full max-w-xs mb-6 text-left space-y-2">
          {session.amount_total != null && (
            <div className="flex justify-between">
              <span className="text-xs text-zinc-500">ยอดชำระ</span>
              <span className="text-xs font-semibold text-zinc-900">฿{(session.amount_total / 100).toLocaleString()}</span>
            </div>
          )}
          {session.customer_email && (
            <div className="flex justify-between gap-3">
              <span className="text-xs text-zinc-500">อีเมล</span>
              <span className="text-xs font-semibold text-zinc-900 break-all text-right">{session.customer_email}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-xs text-zinc-500">สถานะ</span>
            <span className={`text-xs font-semibold ${paid ? "text-green-700" : "text-amber-700"}`}>{paid ? "✅ ชำระแล้ว" : "⏳ รอยืนยัน"}</span>
          </div>
        </div>
      )}

      {paid && <p className="text-xs text-zinc-500 mb-6">ระบบจะส่งยืนยันผ่าน LINE และอีเมลอัตโนมัติ</p>}

      <div className="w-full max-w-xs space-y-3">
        <Link href="/orders" className="btn-primary w-full py-3.5 text-sm text-center block">
          ดูประวัติการสั่งซื้อ →
        </Link>
        <Link href="/shop" className="w-full py-3.5 text-sm text-center block border border-zinc-200 rounded-2xl text-zinc-600 hover:bg-zinc-50">
          {paid ? "ช้อปต่อ" : "กลับไปหน้าร้าน"}
        </Link>
      </div>
      <BottomNav />
    </div>
  );
}

export default function ShopSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
