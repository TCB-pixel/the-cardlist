import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { lineUserId, type, data } = await request.json();

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "No token" }, { status: 500 });

  let message = "";

  if (type === "ticket_approved") {
    message = `🎫 บัตร Priority Guest ได้รับการยืนยันแล้ว!

📍 งาน: ${data.eventTitle}

🎁 สิทธิ์ของคุณ:
• Pokemon Booster Pack M2 JP ฟรี
• สิทธิ์ซื้อ Booster Pack M1-M5 ราคาป้าย 5 ซอง
• ลุ้นซื้อ Booster Box M5A เงามืดคุกคาม ราคาป้าย (20 สิทธิ์)
• ลุ้นสิทธิ์ซื้อ ETB Ascend Heroes ฿2,190 (1 สิทธิ์)

🔑 QR Code: ${data.qrCode}

แสดง QR Code หน้างานเพื่อรับสิทธิ์ได้เลยครับ 🙌`;
  } else if (type === "ticket_rejected") {
    message = `❌ บัตรเข้างาน ${data.eventTitle} ไม่ได้รับการอนุมัติ\n\nกรุณาติดต่อ The Cardlist เพื่อตรวจสอบครับ`;
  } else if (type === "order_approved") {
    message = `✅ คำสั่งซื้อของคุณได้รับการยืนยันแล้ว!\n\n📦 ${data.item}\n💰 ยอดรวม: ฿${data.total}\n\nทีมงาน The Cardlist กำลังเตรียมสินค้าให้คุณครับ 🙌`;
  } else if (type === "order_shipped") {
    message = `🚚 สินค้าของคุณถูกจัดส่งแล้ว!\n\n📦 ${data.item}\n\nกรุณารอรับสินค้าได้เลยครับ`;
  } else if (type === "broadcast") {
    message = data.message;
  }

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
