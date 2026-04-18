export type BannerType = "home" | "tournament";

export type Banner = {
  id: string;
  type: BannerType;
  title: string;
  subtitle: string;
  badge: string;
  ctaLabel: string;
  ctaHref: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  bgColor: string;
  imageUrl: string | null;
  active: boolean;
  order: number;
};

export const DEFAULT_HOME_BANNERS: Banner[] = [
  {
    id: "h1",
    type: "home",
    title: "One Piece TCG\nOP-10 Manga",
    subtitle: "วางจำหน่าย 20 เมษายน 2026",
    badge: "NEW RELEASE",
    ctaLabel: "Pre-order",
    ctaHref: "/shop?category=preorder",
    ctaSecondaryLabel: "ดูทั้งหมด",
    ctaSecondaryHref: "/shop",
    bgColor: "#111111",
    imageUrl: null,
    active: true,
    order: 1,
  },
  {
    id: "h2",
    type: "home",
    title: "Pokémon SV9\nสีดำ-สีขาว",
    subtitle: "Pre-order เปิดแล้ว จำนวนจำกัด",
    badge: "PRE-ORDER",
    ctaLabel: "จองเลย",
    ctaHref: "/shop?category=preorder&tcg=pokemon",
    ctaSecondaryLabel: "ดูสินค้า",
    ctaSecondaryHref: "/shop?tcg=pokemon",
    bgColor: "#1a1a2e",
    imageUrl: null,
    active: true,
    order: 2,
  },
  {
    id: "h3",
    type: "home",
    title: "MTG Aetherdrift\nFull Art Collection",
    subtitle: "Single Cards พร้อมจำหน่ายแล้ว",
    badge: "IN STOCK",
    ctaLabel: "ดูการ์ด",
    ctaHref: "/shop?tcg=mtg",
    bgColor: "#1c1410",
    imageUrl: null,
    active: true,
    order: 3,
  },
];

export const DEFAULT_TOURNAMENT_BANNERS: Banner[] = [
  {
    id: "t1",
    type: "tournament",
    title: "OP Regional Bangkok 2026",
    subtitle: "สยามพารากอน Hall A · 26 เม.ย. · 09:00 น.",
    badge: "ลงทะเบียนได้แล้ว",
    ctaLabel: "ลงทะเบียน",
    ctaHref: "/events",
    bgColor: "#0f0f0f",
    imageUrl: null,
    active: true,
    order: 1,
  },
  {
    id: "t2",
    type: "tournament",
    title: "Pokémon League Cup · In-Store",
    subtitle: "The Cardlist Store · 3 พ.ค. · 13:00 น.",
    badge: "ที่นั่งเหลือน้อย",
    ctaLabel: "จองที่นั่ง",
    ctaHref: "/events",
    bgColor: "#1a0f00",
    imageUrl: null,
    active: true,
    order: 2,
  },
];
