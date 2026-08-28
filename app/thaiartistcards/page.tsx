"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import type { Artist, ArtistCard, ArtistCategory } from "@/lib/types";

const ALL = "ทั้งหมด";

// ─── การ์ดหนึ่งใบในกริด ───
function CardTile({ card, artist, category, onClick }: {
  card: ArtistCard;
  artist?: Artist;
  category?: ArtistCategory;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="card overflow-hidden text-left active:opacity-80 transition-opacity">
      <div className="aspect-[3/4] bg-zinc-100 relative">
        {card.image_url ? (
          // ใช้ <img> แทน next/image เพราะรูปมาจาก Supabase Storage หลายโดเมน/ขนาดไม่แน่นอน
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-zinc-300">🎨</div>
        )}
        {card.limited_count != null && (
          <span className="absolute top-1.5 right-1.5 bg-zinc-900/85 text-white text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider">
            LTD {card.limited_count}
          </span>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[11px] font-semibold text-zinc-900 leading-tight line-clamp-2">{card.name}</p>
        {artist && <p className="text-[9px] text-zinc-400 mt-1 truncate">{artist.name}</p>}
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {category && (
            <span className="bg-zinc-100 text-zinc-600 text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider">
              {category.name}
            </span>
          )}
          {card.rarity && <span className="badge-rare">{card.rarity}</span>}
        </div>
      </div>
    </button>
  );
}

// หัวข้อย่อยในป๊อปอัป — แสดงเฉพาะตอนที่แอดมินกรอกข้อมูลมาเท่านั้น
function DetailSection({ icon, title, body }: { icon: string; title: string; body: string | null }) {
  if (!body?.trim()) return null;
  return (
    <div className="mt-4 pt-4 border-t border-zinc-100">
      <p className="text-[9px] text-zinc-400 tracking-widest font-semibold mb-1.5">
        {icon} {title}
      </p>
      <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}

// ─── ป๊อปอัปรายละเอียดการ์ด ───
function CardDetail({ card, artist, category, onClose }: {
  card: ArtistCard;
  artist?: Artist;
  category?: ArtistCategory;
  onClose: () => void;
}) {
  const socials = artist
    ? ([
        ["Instagram", artist.instagram_url],
        ["Facebook", artist.facebook_url],
        ["X", artist.x_url],
      ] as const).filter(([, url]) => !!url)
    : [];

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="aspect-[3/4] bg-zinc-100 relative">
          {card.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.image_url} alt={card.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-300">🎨</div>
          )}
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-zinc-600 flex items-center justify-center text-lg leading-none">
            ×
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {category && (
              <span className="bg-zinc-100 text-zinc-600 text-[9px] font-bold px-2 py-0.5 rounded tracking-wider">
                {category.name}
              </span>
            )}
            {card.rarity && <span className="badge-rare">{card.rarity}</span>}
            {card.limited_count != null && (
              <span className="bg-amber-50 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded tracking-wider">
                LIMITED {card.limited_count}
              </span>
            )}
          </div>

          <h2 className="text-base font-semibold text-zinc-900 leading-snug">{card.name}</h2>

          {(card.collection || card.release_year) && (
            <p className="text-[11px] text-zinc-400 mt-1">
              {[card.collection, card.release_year].filter(Boolean).join(" · ")}
            </p>
          )}

          {card.description && (
            <p className="text-xs text-zinc-600 leading-relaxed mt-3 whitespace-pre-line">{card.description}</p>
          )}

          <DetailSection icon="✨" title="เรื่องราวเบื้องหลัง" body={card.story} />
          <DetailSection icon="⭐" title="ทำไมการ์ดใบนี้ถึงพิเศษ" body={card.significance} />
          <DetailSection icon="🎟️" title="วิธีได้มา" body={card.how_to_get} />

          {artist && (
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <p className="text-[9px] text-zinc-400 tracking-widest font-semibold mb-2">ศิลปิน</p>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-zinc-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold text-zinc-400">
                  {artist.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={artist.avatar_url} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    artist.name[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 truncate">{artist.name}</p>
                  {artist.bio && <p className="text-[10px] text-zinc-400 line-clamp-2">{artist.bio}</p>}
                </div>
              </div>

              {socials.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {socials.map(([label, url]) => (
                    <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
                      className="btn-secondary text-[10px] px-3 py-1.5">
                      {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ThaiArtistCardsPage() {
  const supabase = createClient();
  const [cards, setCards] = useState<ArtistCard[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [categories, setCategories] = useState<ArtistCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [activeArtist, setActiveArtist] = useState(ALL);
  const [selected, setSelected] = useState<ArtistCard | null>(null);

  useEffect(() => {
    async function load() {
      const [cardsRes, artistsRes, catsRes] = await Promise.all([
        supabase.from("artist_cards").select("*").eq("active", true)
          .order("order", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("artists").select("*").eq("active", true)
          .order("order", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("artist_categories").select("*").eq("active", true)
          .order("order", { ascending: true }).order("created_at", { ascending: true }),
      ]);
      setCards(cardsRes.data ?? []);
      setArtists(artistsRes.data ?? []);
      setCategories(catsRes.data ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const artistById = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // ซ่อนการ์ดของศิลปินที่ถูกปิดใช้งาน (ไม่อยู่ในรายการ artists ที่ active)
  const visible = useMemo(
    () => cards.filter((c) => artistById.has(c.artist_id)),
    [cards, artistById]
  );

  const filtered = useMemo(() => visible.filter((c) => {
    const catOk = activeCategory === ALL || categoryById.get(c.category_id ?? "")?.name === activeCategory;
    const artistOk = activeArtist === ALL || artistById.get(c.artist_id)?.name === activeArtist;
    return catOk && artistOk;
  }), [visible, activeCategory, activeArtist, categoryById, artistById]);

  const categoryTabs = [ALL, ...categories.map((c) => c.name)];
  const artistTabs = [ALL, ...artists.map((a) => a.name)];

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <TopBar title="Artist Cards" />

      {/* บนจอ desktop บีบเนื้อหาเหลือ 70% แล้วจัดกึ่งกลาง — การ์ดเล็กลง 30%
          และได้พื้นที่ว่างสองข้าง ส่วนมือถือ/แท็บเล็ตยังเต็มความกว้างเหมือนเดิม */}
      <div className="lg:max-w-[70%] lg:mx-auto">

      <div className="px-4 pt-4 pb-1">
        <h1 className="text-sm font-semibold text-zinc-900">การ์ดศิลปินไทย</h1>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          รวมผลงานการ์ดจากศิลปินไทย — คัดสรรโดย The Cardlist
        </p>
      </div>

      {/* ตัวกรองหมวดหมู่ */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3">
          {categoryTabs.map((name) => (
            <button key={name} onClick={() => setActiveCategory(name)}
              className={`flex-shrink-0 text-[11px] px-3 py-1.5 rounded-xl border transition-colors ${
                activeCategory === name
                  ? "bg-zinc-900 text-white border-zinc-900 font-semibold"
                  : "bg-white text-zinc-500 border-zinc-200"
              }`}>
              {name}
            </button>
          ))}
        </div>
      )}

      {/* ตัวกรองศิลปิน */}
      {artists.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3">
          {artistTabs.map((name) => (
            <button key={name} onClick={() => setActiveArtist(name)}
              className={`flex-shrink-0 text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                activeArtist === name
                  ? "bg-zinc-200 text-zinc-900 font-semibold"
                  : "bg-white text-zinc-400 border border-zinc-100"
              }`}>
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="px-4">
        {loading ? (
          <p className="text-center text-xs text-zinc-400 py-16">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <div className="card px-4 py-12 text-center">
            <p className="text-2xl mb-2">🎨</p>
            <p className="text-xs text-zinc-400">
              {visible.length === 0 ? "ยังไม่มีการ์ดศิลปิน" : "ไม่พบการ์ดตามที่กรอง"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((card) => (
              <CardTile key={card.id} card={card}
                artist={artistById.get(card.artist_id)}
                category={categoryById.get(card.category_id ?? "")}
                onClick={() => setSelected(card)} />
            ))}
          </div>
        )}
      </div>

      </div>

      {selected && (
        <CardDetail card={selected}
          artist={artistById.get(selected.artist_id)}
          category={categoryById.get(selected.category_id ?? "")}
          onClose={() => setSelected(null)} />
      )}

      <BottomNav />
    </div>
  );
}
