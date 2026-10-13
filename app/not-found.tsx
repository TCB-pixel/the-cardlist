import Link from "next/link";
import BottomNav from "@/components/BottomNav";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6 text-center pb-24">
      <p className="text-5xl font-black text-zinc-900">404</p>
      <h1 className="text-lg font-bold text-zinc-900 mt-3">ไม่พบหน้านี้</h1>
      <p className="text-sm text-zinc-500 mt-1 max-w-xs">ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายไปแล้ว</p>
      <div className="flex gap-2 mt-6">
        <Link href="/" className="btn-primary">กลับหน้าแรก</Link>
        <Link href="/shop" className="btn-outline">ไปที่ร้านค้า</Link>
      </div>
      <BottomNav />
    </div>
  );
}
