// ── LINE Flex: แจ้งจัดส่งแล้ว + เลขพัสดุ ──
// กฎเดียวกับ line-order-flex: LINE ปฏิเสธทั้งข้อความถ้าฟิลด์ผิด จึงกรองทุกค่าและมี altText เสมอ

export type ShippedFlexInput = {
  orderRef: string;
  carrierName: string;
  trackingNo: string;
  trackPage: string | null; // ลิงก์ไปหน้าติดตามของขนส่ง (ต้องเป็น https)
  itemLines: { name: string; qty: number; imageUrl?: string | null }[];
  siteUrl: string;
};

const clip = (s: string, max: number) => {
  const t = (s ?? "").trim() || "-";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
};
const safeHttps = (u?: string | null) => (u && /^https:\/\//i.test(u.trim()) && u.length <= 2000 ? u.trim() : null);

export function buildShippedFlex(o: ShippedFlexInput) {
  const first = o.itemLines.find((i) => safeHttps(i.imageUrl));
  const hero = first ? safeHttps(first.imageUrl) : null;

  const items = o.itemLines.slice(0, 6).map((i) => ({
    type: "text",
    text: `• ${clip(i.name, 60)} × ${i.qty}`,
    size: "sm",
    color: "#52525b",
    wrap: true,
  }));
  if (o.itemLines.length > 6) {
    items.push({ type: "text", text: `และอีก ${o.itemLines.length - 6} รายการ`, size: "xs", color: "#71717a", wrap: true });
  }

  const footerButtons: any[] = [];
  const page = safeHttps(o.trackPage);
  if (page) {
    footerButtons.push({
      type: "button", style: "primary", color: "#18181b", height: "sm",
      action: { type: "uri", label: `เปิดหน้าติดตาม ${clip(o.carrierName, 12)}`.slice(0, 20), uri: page },
    });
  }
  footerButtons.push({
    type: "button", style: "link", height: "sm",
    action: { type: "uri", label: "ดูคำสั่งซื้อของฉัน", uri: `${o.siteUrl}/orders` },
  });

  return {
    type: "flex",
    altText: clip(`🚚 จัดส่งแล้ว #${o.orderRef} · ${o.carrierName} ${o.trackingNo}`, 400),
    contents: {
      type: "bubble",
      size: "mega",
      ...(hero ? { hero: { type: "image", url: hero, size: "full", aspectRatio: "20:13", aspectMode: "cover" } } : {}),
      body: {
        type: "box", layout: "vertical", paddingAll: "lg", spacing: "md",
        contents: [
          { type: "text", text: "🚚 สินค้าของคุณถูกจัดส่งแล้ว!", weight: "bold", size: "lg", color: "#18181b", wrap: true },
          { type: "text", text: `ออเดอร์ #${o.orderRef}`, size: "xs", color: "#71717a" },
          { type: "separator", margin: "md" },
          {
            type: "box", layout: "vertical", margin: "md", spacing: "xs",
            contents: [
              { type: "text", text: "ขนส่ง", size: "xs", color: "#71717a" },
              { type: "text", text: clip(o.carrierName, 40), size: "md", weight: "bold", color: "#18181b" },
              { type: "text", text: "เลขพัสดุ (กดค้างเพื่อคัดลอก)", size: "xs", color: "#71717a", margin: "md" },
              { type: "text", text: clip(o.trackingNo, 40), size: "xl", weight: "bold", color: "#18181b", wrap: true },
            ],
          },
          { type: "separator", margin: "md" },
          { type: "box", layout: "vertical", margin: "md", spacing: "xs", contents: items },
        ],
      },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: footerButtons },
    },
  };
}
