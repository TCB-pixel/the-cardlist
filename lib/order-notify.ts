// ── แจ้งยืนยันออเดอร์: ลูกค้า (อีเมล + LINE การ์ด) และทีมงาน (อีเมล + LINE การ์ด) ──
// แยกจาก stripe-fulfilment เพื่อให้อ่านง่ายและทดสอบเดี่ยวๆ ได้
// หลักการ: ออเดอร์ถูกสร้างเสร็จก่อนเรียกที่นี่เสมอ ช่องทางไหนพังก็ไม่ย้อนกลับไปทำให้ออเดอร์หาย
// และทุกช่องพังแยกกัน ปัญหาถูกจดลง orders.note ให้แอดมินเห็นในหลังบ้าน

import type { SupabaseClient } from "@supabase/supabase-js";
import { renderOrderConfirmEmail, escapeHtml } from "@/lib/order-email";
import { buildOrderFlex, pushFlex } from "@/lib/line-order-flex";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";

export type NotifyShipping = {
  name: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

export type NotifyInput = {
  orderId: string;
  userId: string;
  email: string | null;
  items: any[];
  amountTotal: number; // สตางค์
  shippingFee: number;
  cardFee: number;
  shipping: NotifyShipping | null;
};

// อีเมลปลอมที่ระบบสร้างให้คนล็อกอินด้วย LINE (LINE ไม่ส่งอีเมลมา) — ส่งไปไม่ถึงเสมอ
export const isFakeLineEmail = (e: string | null | undefined) =>
  !!e && /^line_[a-z0-9]+@thecardlist\.com$/i.test(e);

function addressText(a: NotifyShipping | null) {
  if (!a) return "";
  return [
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(" "),
    a.phone ? `โทร ${a.phone}` : "",
  ]
    .filter((x) => x && String(x).trim())
    .join("\n");
}

type MailResult = { ok: true } | { ok: false; error: string };

async function sendEmail(to: string[], subject: string, html: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "ไม่ได้ตั้งค่า RESEND_API_KEY" };
  if (to.length === 0) return { ok: false, error: "ไม่มีผู้รับอีเมล" };
  const from = process.env.ORDER_EMAIL_FROM ?? "The Cardlist <orders@thecardlistbkk.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      console.error("Resend error:", res.status, body);
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err: any) {
    console.error("Resend failed:", err);
    return { ok: false, error: String(err?.message ?? err).slice(0, 300) };
  }
}

const split = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

export async function notifyOrder(supabase: SupabaseClient, n: NotifyInput) {
  const { orderId, userId, items, amountTotal, shippingFee, cardFee, shipping } = n;
  const total = amountTotal / 100;
  const subtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const orderRef = orderId.slice(0, 8).toUpperCase();
  const problems: string[] = [];

  // รูปสินค้า: metadata ของ Stripe ไม่ได้เก็บรูป จึงดึงจากตาราง products ด้วย id
  const ids = items.map((it) => it.id).filter(Boolean);
  const imageById = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: prods } = await supabase.from("products").select("id, image_url").in("id", ids);
    for (const p of prods ?? []) imageById.set(p.id, p.image_url ?? null);
  }
  const lines = items.map((it) => ({
    name: String(it.name ?? "สินค้า"),
    price: Number(it.price),
    qty: Number(it.qty),
    imageUrl: imageById.get(it.id) ?? null,
  }));

  const { data: profile } = await supabase
    .from("profiles")
    .select("line_user_id, receipt_email, display_name")
    .eq("id", userId)
    .maybeSingle();

  // ── อีเมลลูกค้า: ใช้อีเมลรับใบเสร็จที่ลูกค้ากรอกเอง ไม่งั้นใช้อีเมลตอนจ่าย (ตัดอีเมลปลอมของ LINE ทิ้ง) ──
  const customerEmail =
    (profile?.receipt_email && profile.receipt_email.trim()) ||
    (n.email && !isFakeLineEmail(n.email) ? n.email : null);

  if (customerEmail) {
    const r = await sendEmail(
      [customerEmail],
      "ยืนยันคำสั่งซื้อ • The Cardlist",
      renderOrderConfirmEmail({
        items: lines.map((i) => ({ name: i.name, price: i.price, qty: i.qty })),
        total,
        shippingFee,
        cardFee,
        shipping,
        orderId,
      } as any)
    );
    await supabase
      .from("orders")
      .update(
        r.ok
          ? { confirm_email_sent_at: new Date().toISOString(), confirm_email_error: null }
          : { confirm_email_sent_at: null, confirm_email_error: r.error }
      )
      .eq("id", orderId);
    if (!r.ok) problems.push(`อีเมลลูกค้า: ${r.error}`);
  } else {
    // ไม่ใช่ความผิดพลาด แค่ลูกค้ายังไม่มีอีเมลจริง จดไว้ให้แอดมินเห็น
    await supabase
      .from("orders")
      .update({
        confirm_email_sent_at: null,
        confirm_email_error: "ลูกค้ายังไม่ได้กรอกอีเมลจริง (ใช้ LINE ยืนยันแทน)",
      })
      .eq("id", orderId);
  }

  const flexBase = {
    orderRef,
    items: lines,
    subtotal,
    shippingFee,
    cardFee,
    total,
    shippingName: shipping?.name ?? null,
    shippingAddress: addressText(shipping) || null,
    siteUrl: SITE_URL,
  };

  // ── LINE ลูกค้า: การ์ดรูป + จำนวน + ราคา ──
  if (profile?.line_user_id) {
    const r = await pushFlex(profile.line_user_id, buildOrderFlex(flexBase));
    if (!r.ok) problems.push(`LINE ลูกค้า: ${r.error}`);
  }

  // ── แจ้งทีมงาน: LINE การ์ด + อีเมล (ผู้รับตั้งได้ที่ /admin/settings) ──
  try {
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["order_notify_line_ids", "order_notify_emails"]);
    const get = (k: string) => (settings ?? []).find((s: any) => s.key === k)?.value ?? "";
    const lineIds = split(get("order_notify_line_ids"));
    const emails = split(get("order_notify_emails"));

    if (lineIds.length > 0) {
      const flex = buildOrderFlex({
        ...flexBase,
        forStaff: true,
        customerName: shipping?.name ?? profile?.display_name ?? null,
      });
      // ส่งทีละคน คนหนึ่งพังไม่ควรทำให้คนอื่นไม่ได้รับ
      const results = await Promise.all(lineIds.map((id) => pushFlex(id, flex)));
      results.forEach((r) => { if (!r.ok) problems.push(`LINE ทีมงาน: ${r.error}`); });
    }

    if (emails.length > 0) {
      const rows = lines
        .map(
          (i) =>
            `<tr><td style="padding:6px 8px">${escapeHtml(i.name)}</td>` +
            `<td style="padding:6px 8px;text-align:center">${i.qty}</td>` +
            `<td style="padding:6px 8px;text-align:right">฿${(i.price * i.qty).toLocaleString()}</td></tr>`
        )
        .join("");
      const html =
        `<div style="font-family:Arial,sans-serif;max-width:520px">` +
        `<h2 style="margin:0 0 4px">🛒 มีคำสั่งซื้อใหม่ #${orderRef}</h2>` +
        `<p style="color:#71717a;margin:0 0 16px">${escapeHtml(shipping?.name ?? "-")} · ${escapeHtml(n.email ?? "ไม่มีอีเมล")}</p>` +
        `<table style="width:100%;border-collapse:collapse;font-size:14px">` +
        `<tr style="background:#f4f4f5"><th style="padding:6px 8px;text-align:left">สินค้า</th>` +
        `<th style="padding:6px 8px">จำนวน</th><th style="padding:6px 8px;text-align:right">ราคา</th></tr>${rows}</table>` +
        `<p style="margin:12px 0 0">ราคาสินค้า ฿${subtotal.toLocaleString()}<br>ค่าจัดส่ง ฿${shippingFee.toLocaleString()}` +
        `${cardFee > 0 ? `<br>ค่าธรรมเนียมบัตร ฿${cardFee.toLocaleString()}` : ""}<br><b>รวม ฿${total.toLocaleString()}</b></p>` +
        `<p style="margin:16px 0 4px"><b>📦 จัดส่งถึง</b></p>` +
        `<p style="margin:0;white-space:pre-line;color:#52525b">${escapeHtml(shipping?.name ?? "")}\n${escapeHtml(addressText(shipping))}</p>` +
        `<p style="margin:20px 0 0"><a href="${SITE_URL}/admin/orders">เปิดหลังบ้านเพื่อจัดการออเดอร์</a></p></div>`;
      const r = await sendEmail(emails, `🛒 ออเดอร์ใหม่ #${orderRef} · ฿${total.toLocaleString()}`, html);
      if (!r.ok) problems.push(`อีเมลทีมงาน: ${r.error}`);
    }

    if (lineIds.length === 0 && emails.length === 0) {
      problems.push("ยังไม่ได้ตั้งผู้รับแจ้งเตือนออเดอร์ที่ /admin/settings");
    }
  } catch (err: any) {
    console.error("แจ้งทีมงานไม่สำเร็จ (ข้ามไป):", err);
    problems.push(`แจ้งทีมงาน: ${String(err?.message ?? err).slice(0, 120)}`);
  }

  // จดปัญหาไว้ในหมายเหตุออเดอร์ ให้แอดมินเห็นในหลังบ้านว่าช่องไหนไม่ถึง
  if (problems.length > 0) {
    const { data: cur } = await supabase.from("orders").select("note").eq("id", orderId).single();
    const note = [cur?.note, `⚠️ แจ้งเตือนไม่ครบ: ${problems.join(" | ")}`].filter(Boolean).join(" | ");
    await supabase.from("orders").update({ note: note.slice(0, 1000) }).eq("id", orderId);
  }
}
