import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { lineUserId, type, data } = await request.json();

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "No token" }, { status: 500 });

  let message = "";

  if (type === "ticket_approved") {
    message = `🎫 บัตร Priority Guest ได้รับการยืนยันแล้ว!\n\n📍 งาน: ${data.eventTitle}\n\n🎁 สิทธิ์ของคุณ:\n• Booster Pack M1-M5 ฟรี 5 ซอง\n• ลุ้นสิทธิ์ซื้อ Booster Box เงามืดคุกคาม (20 สิทธิ์)\n• ลุ้นสิทธิ์ซื้อ Ascend Heroes ETB ฿2,190 (1 รางวัล)\n• ลุ้นสิทธิ์ซื้อ M5 Abyss Eye ฿1,490 (1 รางวัล)\n\n🔑 QR Code: ${data.qrCode}\n\nแสดง QR Code หน้างานเพื่อรับสิทธิ์ได้เลยครับ 🙌`;
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
