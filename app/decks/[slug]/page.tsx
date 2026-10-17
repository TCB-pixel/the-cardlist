import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { adminDb } from "@/lib/require-admin";
import { tcgLabel } from "@/lib/tcg";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";

// หน้าแชร์เด็ค — เปิดได้เฉพาะเด็คที่เจ้าของกดแชร์ (is_public) · ไม่แสดงข้อมูลเจ้าของเด็ค · ไม่มีราคาการ์ด
export const dynamic = "force-dynamic";

type DeckCard = { card_name: string; quantity: number; card_number?: string; card_id?: string };
type Detail = { id: string; image_url: string | null; card_type: string | null };

async function getDeck(slug: string) {
  if (!/^[a-z0-9]{8,32}$/.test(slug)) return null;
  const { data } = await adminDb
    .from("decks")
    .select("name, tcg, format, description, cards, updated_at")
    .eq("share_slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  return data as { name: string; tcg: string; format: string; description: string; cards: DeckCard[]; updated_at: string } | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const deck = await getDeck((await params).slug);
  return {
    title: deck ? `${deck.name} · Deck` : "Deck", // layout ต่อท้าย " | The Cardlist" ให้เอง
    robots: { index: false, follow: false },
  };
}

export default async function SharedDeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const deck = await getDeck((await params).slug);
  if (!deck) notFound();

  const cards = deck.cards ?? [];
  const ids = [...new Set(cards.map((c) => c.card_id).filter(Boolean) as string[])];
  const details: Record<string, Detail> = {};
  if (ids.length) {
    const { data } = await adminDb.from("tcg_cards").select("id, image_url, card_type").in("id", ids);
    for (const d of (data as Detail[]) ?? []) details[d.id] = d;
  }
  const total = cards.reduce((s, c) => s + c.quantity, 0);
  const typeOf = (c: DeckCard) => (c.card_id ? details[c.card_id]?.card_type : null) ?? "";
  const sorted = [...cards].sort((a, b) => (typeOf(a) === "Leader" ? -1 : 0) - (typeOf(b) === "Leader" ? -1 : 0));
  const updated = new Date(deck.updated_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <TopBar title="Deck" showBack />
      <div className="px-4 py-4 space-y-4 lg:max-w-3xl lg:mx-auto">
        <div className="card px-4 py-4">
          <h1 className="text-lg font-semibold text-zinc-900">{deck.name}</h1>
          <p className="text-[11px] text-zinc-500 mt-1">{tcgLabel(deck.tcg)} · {deck.format} · {total} ใบ · อัปเดต {updated}</p>
          {deck.description && <p className="text-sm text-zinc-700 leading-relaxed mt-3 whitespace-pre-line">{deck.description}</p>}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {sorted.map((c, i) => {
            const d = c.card_id ? details[c.card_id] : undefined;
            return (
              <div key={i} className="card overflow-hidden">
                <div className="relative aspect-[63/88] bg-zinc-100">
                  {d?.image_url
                    ? <img src={d.image_url} alt={c.card_name} loading="lazy" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center p-2 text-center text-[11px] text-zinc-600">{c.card_name}</div>}
                  <span className="absolute bottom-1 right-1 bg-zinc-900 text-white text-xs font-semibold rounded-lg px-1.5 py-0.5">×{c.quantity}</span>
                  {d?.card_type === "Leader" && <span className="absolute top-1 left-1 badge-new">LEADER</span>}
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-[11px] text-zinc-900 truncate">{c.card_name}</p>
                  {c.card_number && <p className="text-[11px] text-zinc-500 truncate">{c.card_number}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card px-4 py-4 text-center">
          <p className="text-xs text-zinc-600">เด็คนี้สร้างด้วย Deck Builder ของ <span className="font-cardlist font-normal tracking-wide">The Cardlist</span></p>
          <Link href="/profile/decks" className="btn-primary inline-block mt-3 px-6">สร้างเด็คของคุณ</Link>
          <p className="text-[11px] text-zinc-500 mt-3">
            {deck.tcg === "Pokémon"
              ? "ข้อมูลการ์ดจาก Pokémon Thailand ©Pokémon/Nintendo/Creatures/GAME FREAK และ TCGdex"
              : "ข้อมูลการ์ดจาก TCGdex / optcgapi.com"} · รูปการ์ดเป็นลิขสิทธิ์ของเจ้าของเกม
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
