"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

type Booking = {
  id: string; status: string; days: string[]; tables: string[]; total: number;
  discount_code: string | null; discount_amount: number; booth_events: { title: string; location: string | null } | null;
};

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

// หลังชำระเงิน: Stripe แจ้ง webhook ก่อน อาจใช้เวลาไม่กี่วินาที จึงถามสถานะซ้ำจนกว่าจะยืนยัน
export default function BoothSuccessPage() {
  const supabase = useMemo(() => createClient(), []);
  const [b, setB] = useState<Booking | null>(null);
  const [tries, setTries] = useState(0);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => { setId(new URLSearchParams(window.location.search).get("booking")); }, []);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/booth/my", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok || stop) return;
      const found = ((await res.json()).bookings as Booking[]).find((x) => x.id === id) ?? null;
      setB(found);
      if (!found || found.status === "hold") setTimeout(() => !stop && setTries((t) => t + 1), 3000);
    })();
    return () => { stop = true; };
  }, [id, tries, supabase]);

  const paid = b?.status === "paid";
  const waiting = !b || b.status === "hold";

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <TopBar title="จองโต๊ะ Vendor" />
      <div className="px-4 py-6 lg:max-w-md lg:mx-auto">
        <div className="bg-white border border-zinc-100 rounded-2xl p-6 text-center">
          {paid ? (
            <>
              <p className="text-3xl mb-2">✅</p>
              <h1 className="text-base font-semibold text-zinc-900">จองโต๊ะสำเร็จ</h1>
              <p className="text-xs text-zinc-500 mt-1">{b?.booth_events?.title}</p>
              <div className="text-left bg-zinc-50 rounded-xl p-3 mt-4 space-y-1 text-sm">
                <p><span className="text-zinc-500">โต๊ะ</span> <b>{b?.tables.join(", ")}</b></p>
                <p><span className="text-zinc-500">วันที่</span> {b?.days.map(dayLabel).join(", ")}</p>
                <p><span className="text-zinc-500">ชำระแล้ว</span> ฿{Math.round(b?.total ?? 0).toLocaleString("th-TH")}{b?.discount_code ? ` (โค้ด ${b.discount_code})` : ""}</p>
              </div>
              <p className="text-[11px] text-zinc-400 mt-3">เก็บหน้านี้ไว้เป็นหลักฐาน หรือดูย้อนหลังได้ที่หน้าจองโต๊ะ → การจองของฉัน</p>
            </>
          ) : b && (b.status === "needs_refund") ? (
            <>
              <p className="text-3xl mb-2">⚠️</p>
              <h1 className="text-base font-semibold text-zinc-900">ได้รับชำระเงินแล้ว แต่โต๊ะถูกจองไปก่อน</h1>
              <p className="text-xs text-zinc-500 mt-2">ทีมงานจะติดต่อเพื่อคืนเงินให้เต็มจำนวน หรือจัดโต๊ะอื่นให้</p>
            </>
          ) : waiting ? (
            <>
              <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3" />
              <h1 className="text-base font-semibold text-zinc-900">กำลังยืนยันการชำระเงิน...</h1>
              <p className="text-xs text-zinc-500 mt-1">ใช้เวลาไม่กี่วินาที ถ้าชำระผ่าน PromptPay อาจนานกว่านั้นเล็กน้อย</p>
              {tries > 20 && <p className="text-[11px] text-amber-700 mt-3">ยังไม่ได้รับการยืนยัน ถ้าชำระเงินแล้วโปรดติดต่อทีมงานพร้อมหลักฐานการชำระ</p>}
            </>
          ) : (
            <>
              <h1 className="text-base font-semibold text-zinc-900">รายการนี้ไม่ได้อยู่ในสถานะชำระแล้ว</h1>
              <p className="text-xs text-zinc-500 mt-1">อาจหมดเวลาหรือถูกยกเลิก ลองจองใหม่อีกครั้ง</p>
            </>
          )}
          <Link href="/booth" className="inline-block mt-5 text-xs font-semibold border border-zinc-200 rounded-xl px-5 py-2 text-zinc-700">กลับหน้าจองโต๊ะ</Link>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
