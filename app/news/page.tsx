"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

type NewsPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  tag: string;
  image_url: string | null;
  published_at: string;
};

const TAGS = ["ทั้งหมด", "TOURNAMENT", "RELEASE", "NEWS", "DECK GUIDE"];

const TAG_COLOR: Record<string, string> = {
  "TOURNAMENT": "bg-red-50 text-red-700",
  "RELEASE": "bg-blue-50 text-blue-700",
  "NEWS": "bg-zinc-100 text-zinc-600",
  "DECK GUIDE": "bg-green-50 text-green-700",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function NewsPage() {
  const supabase = createClient();
  const [activeTag, setActiveTag] = useState("ทั้งหมด");
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("news")
        .select("id, title, slug, excerpt, content, tag, image_url, published_at")
        .order("published_at", { ascending: false });
      setNews(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = news.filter((n) => activeTag === "ทั้งหมด" || n.tag === activeTag);
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured && (
              <Link href={`/news/${featured.slug}`} className="block card overflow-hidden active:bg-zinc-50">
                <div className="h-36 bg-zinc-900 relative flex items-end p-4 overflow-hidden">
                  {featured.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={featured.image_url} alt={featured.title} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-5">
                      <span className="text-8xl font-black text-white">TCG</span>
                    </div>
                  )}
                  <div className="relative">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${TAG_COLOR[featured.tag] ?? "bg-zinc-100 text-zinc-600"}`}>{featured.tag}</span>
                    <h2 className="text-sm font-bold text-white mt-2 leading-snug">{featured.title}</h2>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs text-zinc-500 leading-relaxed">{featured.excerpt}</p>
                  <p className="text-[10px] text-zinc-400 mt-2">{formatDate(featured.published_at)}</p>
                </div>
              </Link>
            )}

            {/* Rest */}
            {rest.map((n) => (
              <Link key={n.id} href={`/news/${n.slug}`} className="card px-4 py-3.5 flex gap-3 items-start active:bg-zinc-50 block">
                <div className="w-12 h-12 bg-zinc-100 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {n.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.image_url} alt={n.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-black text-zinc-400 tracking-tight">TCG</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-widest ${TAG_COLOR[n.tag] ?? "bg-zinc-100 text-zinc-600"}`}>{n.tag}</span>
                  <p className="text-xs font-semibold text-zinc-900 leading-snug mt-1.5 line-clamp-2">{n.title}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{formatDate(n.published_at)}</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-300 flex-shrink-0 mt-1">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            ))}

            {filtered.length === 0 && (
              <p className="text-center text-sm text-zinc-400 py-12">ไม่พบบทความในหมวดนี้</p>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
