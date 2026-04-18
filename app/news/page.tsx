"use client";
import { useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

const TAGS = ["ทั้งหมด", "TOURNAMENT", "RELEASE", "NEWS", "DECK GUIDE"];

const NEWS = [
  { id: "1", tag: "TOURNAMENT", title: "Decklist แชมป์ OP Regional Bangkok 2026", excerpt: "ส่องเด็คของแชมป์งาน OP Regional Bangkok 2026 พร้อม breakdown ทุกใบ", date: "16 เม.ย. 2026", slug: "decklist-op-regional-bkk-2026", tcg: "One Piece" },
  { id: "2", tag: "RELEASE", title: "กำหนดการวางจำหน่าย Q2 2026 ทุกเกม", excerpt: "รวมปฏิทินวางจำหน่ายสินค้าใหม่ OP, Pokémon, MTG, Dragon Ball Q2 2026", date: "10 เม.ย. 2026", slug: "release-schedule-q2-2026", tcg: "All" },
  { id: "3", tag: "DECK GUIDE", title: "แนะนำเด็ค Luffy Aggressive สำหรับผู้เริ่มต้น", excerpt: "เด็คงบไม่เกิน 1,500 บาท ใช้ได้จริงในงานระดับ local", date: "8 เม.ย. 2026", slug: "luffy-aggro-deck-guide", tcg: "One Piece" },
  { id: "4", tag: "NEWS", title: "Pokémon SV9 ประกาศ Card List อย่างเป็นทางการ", excerpt: "ครบทุกใบ! ดูรายชื่อการ์ดทั้งหมดใน Pokémon Scarlet & Violet SV9", date: "5 เม.ย. 2026", slug: "pokemon-sv9-card-list", tcg: "Pokémon" },
  { id: "5", tag: "TOURNAMENT", title: "สรุปผล MTG Pro Tour — Top 8 Decklists", excerpt: "ผลการแข่งขัน Pro Tour ล่าสุด พร้อม Decklist ของ Top 8 ทุกคน", date: "1 เม.ย. 2026", slug: "mtg-pro-tour-top8", tcg: "MTG" },
  { id: "6", tag: "NEWS", title: "The Cardlist เปิดสาขาใหม่ย่าน Onnut", excerpt: "ขยายสาขา The Cardlist Store สาขา 2 ที่ถนนอ่อนนุช เปิดให้บริการ 1 พ.ค. นี้", date: "28 มี.ค. 2026", slug: "new-branch-onnut", tcg: "All" },
];

const TAG_COLOR: Record<string, string> = {
  "TOURNAMENT": "bg-red-50 text-red-700",
  "RELEASE": "bg-blue-50 text-blue-700",
  "NEWS": "bg-zinc-100 text-zinc-600",
  "DECK GUIDE": "bg-green-50 text-green-700",
};

export default function NewsPage() {
  const [activeTag, setActiveTag] = useState("ทั้งหมด");

  const filtered = NEWS.filter((n) => activeTag === "ทั้งหมด" || n.tag === activeTag);
  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <TopBar title="ข่าวสาร & บทความ" />

      {/* Tag filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3 bg-white border-b border-zinc-100">
        {TAGS.map((tag) => (
          <button key={tag} onClick={() => setActiveTag(tag)}
            className={`flex-shrink-0 text-[10px] px-3 py-1.5 rounded-full border tracking-wide transition-colors ${activeTag === tag ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
            {tag}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Featured */}
        {featured && (
          <Link href={`/news/${featured.slug}`} className="block card overflow-hidden active:bg-zinc-50">
            <div className="h-36 bg-zinc-900 relative flex items-end p-4">
              <div className="absolute inset-0 flex items-center justify-center opacity-5">
                <span className="text-8xl font-black text-white">{featured.tcg === "All" ? "TCG" : featured.tcg.slice(0,2).toUpperCase()}</span>
              </div>
              <div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${TAG_COLOR[featured.tag] ?? "bg-zinc-100 text-zinc-600"}`}>{featured.tag}</span>
                <h2 className="text-sm font-bold text-white mt-2 leading-snug">{featured.title}</h2>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-zinc-500 leading-relaxed">{featured.excerpt}</p>
              <p className="text-[10px] text-zinc-400 mt-2">{featured.date}</p>
            </div>
          </Link>
        )}

        {/* Rest */}
        {rest.map((n) => (
          <Link key={n.id} href={`/news/${n.slug}`} className="card px-4 py-3.5 flex gap-3 items-start active:bg-zinc-50 block">
            <div className="w-12 h-12 bg-zinc-100 rounded-xl flex-shrink-0 flex items-center justify-center">
              <span className="text-[10px] font-black text-zinc-400 tracking-tight">{n.tcg === "All" ? "TCG" : n.tcg.slice(0,2).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-widest ${TAG_COLOR[n.tag] ?? "bg-zinc-100 text-zinc-600"}`}>{n.tag}</span>
              <p className="text-xs font-semibold text-zinc-900 leading-snug mt-1.5 line-clamp-2">{n.title}</p>
              <p className="text-[10px] text-zinc-400 mt-1">{n.date}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-300 flex-shrink-0 mt-1">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        ))}

        {filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-400 py-12">ไม่พบบทความในหมวดนี้</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
