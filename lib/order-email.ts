// อีเมลยืนยันคำสั่งซื้อ — เทมเพลตเดียว ใช้ทั้งตอนส่งจริงและตอนพรีวิวในหน้าแอดมิน
// แยกออกมาจาก webhook เพื่อไม่ให้หน้าตาอีเมลที่ลูกค้าได้รับ กับที่แอดมินเห็นตอนพรีวิว หลุดจากกัน

/** ค่าบริการจัดส่ง คิดต่อ 1 คำสั่งซื้อ ไม่ใช่ต่อชิ้น */
export const SHIPPING_FEE = 50;

export type OrderEmailItem = { name: string; price: number; qty: number };

export type OrderEmailData = {
  items: OrderEmailItem[];
  /** ยอดรวมทั้งหมดที่ลูกค้าจ่ายจริง (บาท) รวมค่าส่งและค่าธรรมเนียมบัตรแล้ว */
  total: number;
  shippingFee: number;
  /** ค่าธรรมเนียมบัตรเครดิต/เดบิต 3% — 0 ถ้าจ่าย PromptPay */
  cardFee: number;
  shipping: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    phone?: string | null;
  } | null;
  orderId: string;
};

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const baht = (n: number) => `฿${Number(n).toLocaleString("th-TH")}`;

export function renderOrderConfirmEmail(o: OrderEmailData): string {
  const subtotal = o.items.reduce(
    (sum, it) => sum + Number(it.price) * Number(it.qty),
    0
  );

  const itemsHtml = o.items
    .map(
      (it) =>
        `<tr>
          <td style="padding:8px 0;color:#27272a">${escapeHtml(String(it.name ?? ""))}</td>
          <td style="padding:8px 0;color:#71717a;text-align:center;white-space:nowrap">x${Number(it.qty)}</td>
          <td style="padding:8px 0;color:#27272a;text-align:right;white-space:nowrap">${baht(
            Number(it.price) * Number(it.qty)
          )}</td>
        </tr>`
    )
    .join("");

  // แจกแจงให้ลูกค้าเห็นว่าค่าส่งกับค่าธรรมเนียมบัตรมาจากไหน ไม่ใช่โผล่มาในยอดรวมเฉย ๆ
  const summaryRow = (label: string, value: string, strong = false) =>
    `<tr>
      <td style="padding:${strong ? "10px 0 0" : "4px 0"};color:${strong ? "#18181b" : "#71717a"};font-size:${strong ? "15px" : "13px"};font-weight:${strong ? "700" : "400"}">${label}</td>
      <td style="padding:${strong ? "10px 0 0" : "4px 0"};color:${strong ? "#18181b" : "#52525b"};font-size:${strong ? "15px" : "13px"};font-weight:${strong ? "700" : "400"};text-align:right;white-space:nowrap">${value}</td>
    </tr>`;

  const summaryHtml = [
    summaryRow("ราคาสินค้า", baht(subtotal)),
    o.shippingFee > 0 ? summaryRow("ค่าจัดส่ง", baht(o.shippingFee)) : "",
    o.cardFee > 0
      ? summaryRow("ค่าธรรมเนียมบัตร (3%)", baht(o.cardFee))
      : "",
    summaryRow("รวมทั้งหมด", baht(o.total), true),
  ].join("");

  const a = o.shipping;
  const addrHtml = a
    ? [
        escapeHtml(a.name ?? ""),
        `${escapeHtml(a.line1 ?? "")} ${escapeHtml(a.line2 ?? "")}`.trim(),
        `${escapeHtml(a.city ?? "")} ${escapeHtml(a.state ?? "")} ${escapeHtml(
          a.postal_code ?? ""
        )}`.trim(),
        a.phone ? `โทร ${escapeHtml(a.phone)}` : "",
      ]
        .filter(Boolean)
        .join("<br>")
    : "-";

  return `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,'Noto Sans Thai',sans-serif;background:#fafafa;padding:24px 12px">
    <div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7">

      <div style="padding:28px 24px 20px;border-bottom:1px solid #f4f4f5">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;color:#a1a1aa;font-weight:700">THE CARDLIST</p>
        <h1 style="margin:0 0 6px;font-size:21px;color:#18181b">ยืนยันคำสั่งซื้อ</h1>
        <p style="margin:0;color:#71717a;font-size:13px">ขอบคุณที่สั่งซื้อกับเราครับ เราได้รับคำสั่งซื้อและการชำระเงินเรียบร้อยแล้ว</p>
      </div>

      <div style="padding:20px 24px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#3f3f46">รายการสินค้า</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${itemsHtml}</table>

        <table style="width:100%;border-collapse:collapse;margin-top:12px;border-top:1px solid #e4e4e7;padding-top:8px">
          ${summaryHtml}
        </table>
      </div>

      <div style="padding:0 24px 20px">
        <div style="background:#fafafa;border-radius:12px;padding:14px 16px">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#3f3f46">ที่อยู่จัดส่ง</p>
          <p style="margin:0;color:#52525b;font-size:13px;line-height:1.7">${addrHtml}</p>
        </div>
      </div>

      <div style="padding:0 24px 26px">
        <p style="margin:0 0 4px;color:#52525b;font-size:13px">ทีมงานจะแพ็กและจัดส่งให้เร็วที่สุด แล้วจะแจ้งเลขพัสดุให้ทราบอีกครั้งครับ</p>
        <p style="margin:12px 0 0;color:#a1a1aa;font-size:11px">เลขคำสั่งซื้อ: ${escapeHtml(o.orderId)}</p>
      </div>

    </div>
  </div>`;
}
