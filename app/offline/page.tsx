import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M4 4l20 20M14 6a12 12 0 018.5 3.5M5.5 9.5A12 12 0 0114 6M10 13a6 6 0 018.5.5M9.5 13.5A6 6 0 0114 12M14 18v.01" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <h1 className="text-lg font-bold text-zinc-900 mb-2">ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
      <p className="text-sm text-zinc-400 mb-6">กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง</p>
      <Link href="/" className="bg-zinc-900 text-white text-sm font-semibold px-6 py-3 rounded-xl">ลองใหม่</Link>
    </div>
  );
}
