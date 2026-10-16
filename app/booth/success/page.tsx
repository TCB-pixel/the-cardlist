"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { goLogin } from "@/lib/auth-next";
import { useLang } from "@/lib/i18n";

type Booking = {
  id: string; status: string; days: string[]; tables: string[]; total: number;
  discount_code: string | null; discount_amount: number; booth_events: { title: string; location: string | null } | null;
};

const fmtDayLabel = (d: string, locale: string) =>
  new Date(`${d}T00:00:00+07:00`).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

// หลังชำระเงิน: Stripe แจ้ง webhook ก่อน อาจใช้เวลาไม่กี่วินาที จึงถามสถานะซ้ำจนกว่าจะยืนยัน
export default function BoothSuccessPage() {
  const { L, locale } = useLang();
  const dayLabel = (d: string) => fmtDayLabel(d, locale);
  const supabase = useMemo(() => createClient(), []);
  const [b, setB] = useState<Booking | null>(null);
  const [tries, setTries] = useState(0);
  const [id, setId] = useState<string | null>(null);

  // ไม่มีรหัสการจองใน URL หรือยังไม่ได้เข้าสู่ระบบ → บอกให้ชัด แทนการหมุนรอไม่จบ
  const [problem, setProblem] = useState<null | "missing" | "login">(null);

  useEffect(() => {
    const bk = new URLSearchParams(window.location.search).get("booking");
    setId(bk);
    if (!bk) setProblem("missing");
  }, []);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setProblem("login"); return; }
      let res: Response;
      try {
        res = await fetch("/api/booth/my", { headers: { Authorization: `Bearer ${session.access_token}` } });
      } catch {
        if (!stop) setTimeout(() => !stop && setTries((t) => t + 1), 3000);
        return;
      }
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
      <TopBar title={L("จองโต๊ะ Vendor", "Book a Vendor Table")} />
      <div className="px-4 py-6 lg:max-w-md lg:mx-auto">
        <div className="bg-white border border-zinc-100 rounded-2xl p-6 text-center">
          {problem ? (
            <>
              <h1 className="text-base font-semibold text-zinc-900">{problem === "login" ? L("เข้าสู่ระบบเพื่อดูการจองของคุณ", "Log in to see your booking") : L("ไม่พบรายการจอง", "Booking not found")}</h1>
              <p className="text-xs text-zinc-500 mt-1">
                {problem === "login" ? L("เข้าสู่ระบบด้วยบัญชีที่ใช้จอง แล้วระบบจะแสดงสถานะการจองให้", "Log in with the account you booked with to see its status") : L("ดูรายการทั้งหมดได้ที่หน้าจองโต๊ะ → การจองของฉัน", "See all bookings on the booking page → My bookings")}
              </p>
              {problem === "login" && (
                <button onClick={goLogin} className="inline-block mt-4 text-xs font-semibold bg-zinc-900 text-white rounded-xl px-5 py-2.5">{L("เข้าสู่ระบบ", "Log in")}</button>
              )}
            </>
          ) : paid ? (
            <>
              <p className="text-3xl mb-2">✅</p>
              <h1 className="text-base font-semibold text-zinc-900">{L("จองโต๊ะสำเร็จ", "Table booked!")}</h1>
              <p className="text-xs text-zinc-500 mt-1">{b?.booth_events?.title}</p>
              <div className="text-left bg-zinc-50 rounded-xl p-3 mt-4 space-y-1 text-sm">
                <p><span className="text-zinc-500">{L("โต๊ะ", "Tables")}</span> <b>{b?.tables.join(", ")}</b></p>
                <p><span className="text-zinc-500">{L("วันที่", "Days")}</span> {b?.days.map(dayLabel).join(", ")}</p>
                <p><span className="text-zinc-500">{L("ชำระแล้ว", "Paid")}</span> ฿{Math.round(b?.total ?? 0).toLocaleString(locale)}{b?.discount_code ? ` (${L("โค้ด", "code")} ${b.discount_code})` : ""}</p>
              </div>
              <p className="text-[11px] text-zinc-500 mt-3">{L("เก็บหน้านี้ไว้เป็นหลักฐาน หรือดูย้อนหลังได้ที่หน้าจองโต๊ะ → การจองของฉัน", "Keep this page as proof, or find it later on the booking page → My bookings")}</p>
            </>
          ) : b && (b.status === "needs_refund") ? (
            <>
              <p className="text-3xl mb-2">⚠️</p>
              <h1 className="text-base font-semibold text-zinc-900">{L("ได้รับชำระเงินแล้ว แต่โต๊ะถูกจองไปก่อน", "Payment received, but the table was already taken")}</h1>
              <p className="text-xs text-zinc-500 mt-2">{L("ทีมงานจะติดต่อเพื่อคืนเงินให้เต็มจำนวน หรือจัดโต๊ะอื่นให้", "Our team will contact you for a full refund or a different table")}</p>
            </>
          ) : waiting ? (
            <>
              <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3" />
              <h1 className="text-base font-semibold text-zinc-900">{L("กำลังยืนยันการชำระเงิน...", "Confirming your payment...")}</h1>
              <p className="text-xs text-zinc-500 mt-1">{L("ใช้เวลาไม่กี่วินาที ถ้าชำระผ่าน PromptPay อาจนานกว่านั้นเล็กน้อย", "This takes a few seconds. PromptPay may take a little longer.")}</p>
              {tries > 20 && <p className="text-[11px] text-amber-700 mt-3">{L("ยังไม่ได้รับการยืนยัน ถ้าชำระเงินแล้วโปรดติดต่อทีมงานพร้อมหลักฐานการชำระ", "Not confirmed yet. If you've paid, please contact our team with your payment proof.")}</p>}
            </>
          ) : (
            <>
              <h1 className="text-base font-semibold text-zinc-900">{L("รายการนี้ไม่ได้อยู่ในสถานะชำระแล้ว", "This booking isn't marked as paid")}</h1>
              <p className="text-xs text-zinc-500 mt-1">{L("อาจหมดเวลาหรือถูกยกเลิก ลองจองใหม่อีกครั้ง", "It may have expired or been cancelled. Please try booking again.")}</p>
            </>
          )}
          <Link href="/booth" className="inline-block mt-5 text-xs font-semibold border border-zinc-200 rounded-xl px-5 py-2 text-zinc-700">{L("กลับหน้าจองโต๊ะ", "Back to table booking")}</Link>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
