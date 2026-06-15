"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) { router.push("/shop"); return; }
    async function load() {
      try {
        const res = await fetch(`/api/stripe/checkout?session_id=${sessionId}`);
        const data = await res.json();
        setSession(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, [sessionId]);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
      <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M8 18l7 7L28 10" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h1 className="text-xl font-bold text-zinc-900 mb-2">ชำระเงินสำเร็จ!</h1>
      <p className="text-sm text-zinc-400 mb-8">ขอบคุณที่สั่งซื้อกับ The Cardlist 🙌</p>

      <div className="bg-zinc-50 rounded-2xl p-4 w-full max-w-xs mb-6 text-left space-y-2">
        {session?.amount_total && (
          <div className="flex justify-between">
            <span className="text-[11px] text-zinc-400">ยอดชำระ</span>
            <span className="text-[11px] font-semibold text-zinc-900">฿{(session.amount_total / 100).toLocaleString()}</span>
          </div>
        )}
        {session?.customer_email && (
          <div className="flex justify-between">
            <span className="text-[11px] text-zinc-400">อีเมล</span>
            <span className="text-[11px] font-semibold text-zinc-900">{session.customer_email}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-400">สถานะ</span>
          <span className="text-[11px] font-semibold text-green-600">✅ ชำระแล้ว</span>
        </div>
      </div>

      <p className="text-xs text-zinc-400 mb-6">ทีมงานจะติดต่อกลับเพื่อยืนยันคำสั่งซื้อเร็วๆ นี้</p>

      <div className="w-full max-w-xs space-y-3">
        <Link href="/profile" className="btn-primary w-full py-3.5 text-sm text-center block">
          ดูประวัติการสั่งซื้อ →
        </Link>
        <Link href="/shop" className="w-full py-3.5 text-sm text-center block border border-zinc-200 rounded-2xl text-zinc-600 hover:bg-zinc-50">
          ช้อปต่อ
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
