// ── LINE Flex Message: ยืนยันคำสั่งซื้อ (รูป + จำนวน + ราคาต่อรายการ) ──
// เอกสาร: https://developers.line.biz/en/docs/messaging-api/using-flex-messages/
// หมายเหตุ: LINE ปฏิเสธข้อความทั้งก้อนถ้าฟิลด์ไหนผิดรูปแบบ (เช่น รูปไม่ใช่ https, ข้อความว่าง)
//          ฟังก์ชันนี้จึงกรองทุกค่าก่อนใส่ และมี altText เสมอ

export type FlexOrderItem = {
  name: string;
  price: number;
  qty: number;
  imageUrl?: string | null;
};

export type FlexOrderInput = {
  orderRef: string; // เลขอ้างอิงสั้น เช่น 5936D514
  items: FlexOrderItem[];
  subtotal: number;
  shippingFee: number;
  cardFee: number;
  total: number;
  shippingName?: string | null;
  shippingAddress?: string | null;
  siteUrl: string;
  // true = ส่งให้ทีมงาน (หัวข้อต่าง + แสดงลูกค้า) / false = ส่งให้ลูกค้า
  forStaff?: boolean;
  customerName?: string | null;
};

const baht = (n: number) => `฿${Number(n).toLocaleString("th-TH")}`;

// LINE รับเฉพาะ https และยาวไม่เกิน 2000 ตัวอักษร
function safeImage(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!/^https:\/\//i.test(u) || u.length > 2000) return null;
  return u;
}

// ตัดข้อความให้ไม่เกินความยาวที่กำหนด (กันข้อความยาวเกินจนการ์ดพัง)
function clip(s: string, max: number) {
  const t = (s ?? "").trim() || "-";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function itemRow(it: FlexOrderItem) {
  const img = safeImage(it.imageUrl);
  const text = {
    type: "box",
    layout: "vertical",
    flex: 1,
    spacing: "xs",
    contents: [
      { type: "text", text: clip(it.name, 60), size: "sm", weight: "bold", wrap: true, color: "#18181b" },
      {
        type: "text",
        text: `${baht(it.price)} × ${it.qty}`,
        size: "xs",
        color: "#71717a",
      },
      { type: "text", text: baht(it.price * it.qty), size: "sm", weight: "bold", color: "#18181b" },
    ],
  };

  // ไม่มีรูป = แสดงแค่ข้อความ (ไม่ใส่ image ที่ว่าง เพราะ LINE จะปฏิเสธทั้งข้อความ)
  if (!img) return { type: "box", layout: "horizontal", spacing: "md", contents: [text] };

  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      {
        type: "image",
        url: img,
        size: "72px",
        aspectMode: "cover",
        aspectRatio: "1:1",
        flex: 0,
      },
      text,
    ],
  };
}

export function buildOrderFlex(o: FlexOrderInput) {
  const title = o.forStaff ? "🛒 มีคำสั่งซื้อใหม่" : "✅ ชำระเงินสำเร็จ";
  const sub = o.forStaff
    ? `${o.customerName ? clip(o.customerName, 30) + " · " : ""}#${o.orderRef}`
    : `ขอบคุณที่สั่งซื้อกับ The Cardlist · #${o.orderRef}`;

  const rows: any[] = [];
  o.items.slice(0, 10).forEach((it, i) => {
    if (i > 0) rows.push({ type: "separator", margin: "md" });
    rows.push({ ...itemRow(it), margin: i > 0 ? "md" : "none" });
  });
  if (o.items.length > 10) {
    rows.push({ type: "text", text: `และอีก ${o.items.length - 10} รายการ`, size: "xs", color: "#71717a", margin: "md" });
  }

  const sumLine = (label: string, value: string, bold = false) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: bold ? "md" : "sm", color: bold ? "#18181b" : "#71717a", weight: bold ? "bold" : "regular" },
      { type: "text", text: value, size: bold ? "md" : "sm", align: "end", color: "#18181b", weight: bold ? "bold" : "regular" },
    ],
  });

  const summary: any[] = [
    sumLine("ราคาสินค้า", baht(o.subtotal)),
    sumLine("ค่าจัดส่ง", baht(o.shippingFee)),
  ];
  if (o.cardFee > 0) summary.push(sumLine("ค่าธรรมเนียมบัตร", baht(o.cardFee)));
  summary.push({ type: "separator", margin: "sm" });
  summary.push(sumLine("ยอดรวม", baht(o.total), true));

  const body: any[] = [
    { type: "text", text: title, weight: "bold", size: "lg", color: "#18181b" },
    { type: "text", text: sub, size: "xs", color: "#71717a", margin: "xs", wrap: true },
    { type: "separator", margin: "lg" },
    { type: "box", layout: "vertical", margin: "lg", contents: rows },
    { type: "separator", margin: "lg" },
    { type: "box", layout: "vertical", margin: "lg", spacing: "sm", contents: summary },
  ];

  if (o.shippingAddress) {
    body.push({ type: "separator", margin: "lg" });
    body.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "xs",
      contents: [
        { type: "text", text: "📦 จัดส่งถึง", size: "xs", color: "#71717a" },
        ...(o.shippingName ? [{ type: "text", text: clip(o.shippingName, 60), size: "sm", weight: "bold", wrap: true }] : []),
        { type: "text", text: clip(o.shippingAddress, 300), size: "xs", color: "#52525b", wrap: true },
      ],
    });
  }

  const footerUrl = o.forStaff ? `${o.siteUrl}/admin/orders` : `${o.siteUrl}/orders`;

  return {
    type: "flex",
    // altText แสดงในรายการแชทและการแจ้งเตือนบนมือถือ — จำเป็นต้องมีและห้ามว่าง
    altText: clip(
      o.forStaff
        ? `🛒 ออเดอร์ใหม่ #${o.orderRef} ยอด ${baht(o.total)}`
        : `✅ ชำระเงินสำเร็จ #${o.orderRef} ยอด ${baht(o.total)}`,
      400
    ),
    contents: {
      type: "bubble",
      size: "mega",
      body: { type: "box", layout: "vertical", paddingAll: "lg", contents: body },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#18181b",
            height: "sm",
            action: { type: "uri", label: o.forStaff ? "เปิดหลังบ้าน" : "ดูคำสั่งซื้อของฉัน", uri: footerUrl },
          },
        ],
      },
    },
  };
}

// ส่ง Flex ผ่าน LINE Messaging API — คืนผลให้ผู้เรียกรู้ว่าสำเร็จไหม (ไม่ throw)
export async function pushFlex(
  to: string,
  flex: ReturnType<typeof buildOrderFlex>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "ไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" };
  if (!to) return { ok: false, error: "ไม่มี LINE userId" };

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [flex] }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      console.error("LINE flex push failed:", res.status, body);
      return { ok: false, error: `LINE ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err: any) {
    console.error("LINE flex push error:", err);
    return { ok: false, error: String(err?.message ?? err).slice(0, 300) };
  }
}
