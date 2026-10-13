// ── LINE Flex: ยืนยันการจองโต๊ะ Vendor ──
// กฎเดียวกับ line-order-flex: LINE ปฏิเสธทั้งข้อความถ้าฟิลด์ผิด จึงกรองทุกค่าและมี altText เสมอ

export type BoothFlexInput = {
  eventTitle: string;
  location: string | null;
  shopName: string;
  tables: string[];
  daysLabel: string; // เช่น "20, 21, 22 พ.ย." หรือ "ครบ 3 วัน (20–22 พ.ย.)"
  subtotal: number;
  discountCode: string | null;
  discountAmount: number;
  cardFee: number;
  total: number;
  bookingRef: string;
  siteUrl: string;
};

const clip = (s: string, max: number) => {
  const t = (s ?? "").trim() || "-";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
};
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

function row(label: string, value: string, opts: { bold?: boolean; color?: string } = {}) {
  return {
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: clip(label, 40), size: "sm", color: "#71717a", flex: 3, wrap: true },
      { type: "text", text: clip(value, 60), size: "sm", color: opts.color ?? "#18181b", weight: opts.bold ? "bold" : "regular", align: "end", flex: 4, wrap: true },
    ],
  };
}

export function buildBoothFlex(o: BoothFlexInput) {
  const rows: any[] = [
    row("งาน", o.eventTitle),
    ...(o.location ? [row("สถานที่", o.location)] : []),
    row("ร้าน", o.shopName),
    row("โต๊ะ", o.tables.join(", "), { bold: true }),
    row("วันที่", o.daysLabel),
  ];

  const sums: any[] = [row("ยอดโต๊ะ", baht(o.subtotal))];
  if (o.discountAmount > 0) {
    sums.push(row(`ส่วนลด${o.discountCode ? ` (${o.discountCode})` : ""}`, `-${baht(o.discountAmount)}`, { color: "#16a34a" }));
  }
  if (o.cardFee > 0) sums.push(row("ค่าธรรมเนียมบัตร 3%", baht(o.cardFee)));
  sums.push({
    type: "box", layout: "horizontal", margin: "sm",
    contents: [
      { type: "text", text: "ชำระแล้ว", size: "md", weight: "bold", color: "#18181b", flex: 3 },
      { type: "text", text: baht(o.total), size: "lg", weight: "bold", color: "#18181b", align: "end", flex: 4 },
    ],
  });

  return {
    type: "flex",
    altText: clip(`✅ จองโต๊ะสำเร็จ · ${o.eventTitle} · โต๊ะ ${o.tables.join(", ")}`, 400),
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box", layout: "vertical", paddingAll: "lg", spacing: "md",
        contents: [
          { type: "text", text: "✅ จองโต๊ะสำเร็จ", weight: "bold", size: "lg", color: "#18181b", wrap: true },
          { type: "text", text: `รหัสการจอง #${o.bookingRef}`, size: "xs", color: "#71717a" },
          { type: "separator", margin: "md" },
          { type: "box", layout: "vertical", margin: "md", spacing: "sm", contents: rows },
          { type: "separator", margin: "md" },
          { type: "box", layout: "vertical", margin: "md", spacing: "xs", contents: sums },
          { type: "text", text: "เก็บข้อความนี้ไว้เป็นหลักฐานการจอง ขอบคุณที่ร่วมงานกับ The Cardlist", size: "xs", color: "#71717a", wrap: true, margin: "md" },
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          {
            type: "button", style: "link", height: "sm",
            action: { type: "uri", label: "ดูการจองของฉัน", uri: `${o.siteUrl}/booth` },
          },
        ],
      },
    },
  };
}
