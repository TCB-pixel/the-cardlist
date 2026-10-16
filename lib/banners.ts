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
  imageUrl: string | null;        // Background image (overlay 75% dark)
  productImageUrl: string | null; // Product image (box/pack) — แสดงฝั่งขวา
  active: boolean;
  order: number;
};

// แบนเนอร์สำรอง: แสดงก่อนแบนเนอร์จากหลังบ้านโหลดเสร็จ หรือเมื่อหลังบ้านไม่มีแบนเนอร์ที่เปิดใช้
// ตั้งใจไม่ใส่วันที่/สินค้าเฉพาะรุ่น เพื่อไม่ให้ข้อความหมดอายุค้างอยู่บนหน้าแรก
export const DEFAULT_HOME_BANNERS: Banner[] = [
  {
    id: "h1",
    type: "home",
    title: "The Cardlist\nชุมชนการ์ดเกมไทย",
    subtitle: "ซื้อการ์ด · เข้าร่วมอีเวนต์ · จองโต๊ะร้านค้าในงาน",
    badge: "THE CARDLIST",
    ctaLabel: "ไปช้อปเลย",
    ctaHref: "/shop",
    ctaSecondaryLabel: "ดูอีเวนต์",
    ctaSecondaryHref: "/events",
    bgColor: "#111111",
    imageUrl: null,
    productImageUrl: null,
    active: true,
    order: 1,
  },
  {
    id: "h2",
    type: "home",
    title: "จองโต๊ะ Vendor\nในงานอีเวนต์",
    subtitle: "เลือกโต๊ะจากผังงานจริง แล้วชำระเงินได้ทันที",
    badge: "VENDOR",
    ctaLabel: "จองโต๊ะ",
    ctaHref: "/booth",
    bgColor: "#1a1a2e",
    imageUrl: null,
    productImageUrl: null,
    active: true,
    order: 2,
  },
];

// แบนเนอร์สำรองฉบับภาษาอังกฤษ (โครงเดียวกับ DEFAULT_HOME_BANNERS)
export const DEFAULT_HOME_BANNERS_EN: Banner[] = [
  {
    ...DEFAULT_HOME_BANNERS[0],
    title: "The Cardlist\nThailand's TCG community",
    subtitle: "Buy cards · Join events · Book vendor tables",
    ctaLabel: "Shop now",
    ctaSecondaryLabel: "See events",
  },
  {
    ...DEFAULT_HOME_BANNERS[1],
    title: "Book a Vendor table\nat our events",
    subtitle: "Pick a table from the real floor plan and pay instantly",
    ctaLabel: "Book a table",
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
    productImageUrl: null,
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
    productImageUrl: null,
    active: true,
    order: 2,
  },
];
