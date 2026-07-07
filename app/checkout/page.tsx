"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ระบบชำระเงินสลิปโอน + PromptPay แบบแมนวลของหน้านี้ถูกปิดใช้งานแล้ว
// ร้านเดินระบบชำระเงินผ่าน Stripe Checkout เพียงทางเดียว (ดู /shop)
// ไฟล์นี้ไม่ถูกลบไว้เผื่อย้อนกลับมาใช้ในอนาคต
export default function CheckoutPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/shop");
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );
}
