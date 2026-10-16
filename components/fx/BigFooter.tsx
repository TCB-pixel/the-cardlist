import Link from "next/link";

// ท้ายหน้าแบบชื่อแบรนด์ตัวใหญ่ (แรงบันดาลใจ: Large Name Footer บน 21st.dev) — THE CARDLIST ใช้ฟอนต์ CardlistDisplay
export default function BigFooter() {
  return (
    <footer className="px-4 pt-8 pb-6 mt-2 bg-white border-t border-zinc-100 overflow-hidden">
      <div className="grid grid-cols-2 gap-4 text-[11px] text-zinc-600">
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold tracking-widest text-zinc-400">เว็บไซต์</p>
          <Link href="/shop" className="block">ร้านค้า</Link>
          <Link href="/events" className="block">อีเวนต์</Link>
          <Link href="/booth" className="block">จองบูธ</Link>
          <Link href="/news" className="block">ข่าวสาร</Link>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold tracking-widest text-zinc-400">ติดตาม</p>
          <a href="https://www.facebook.com/thecardlistbkk" target="_blank" rel="noreferrer" className="block">Facebook</a>
          <a href="https://www.instagram.com/the_cardlist" target="_blank" rel="noreferrer" className="block">Instagram</a>
          <a href="https://www.tiktok.com/@the.cardlist" target="_blank" rel="noreferrer" className="block">TikTok</a>
        </div>
      </div>
      <p className="fx-bigname font-cardlist" aria-hidden="true">THE CARDLIST</p>
      <p className="text-[10px] text-zinc-400 text-center">© {new Date().getFullYear()} The Cardlist · Bangkok</p>
    </footer>
  );
}
