// ตัวช่วยคุยกับ LINE Messaging API
// reply = ตอบกลับด้วย replyToken (ฟรี ไม่นับโควตา) / push = ส่งหาใครก็ได้ (นับโควตา)

const LINE_API = "https://api.line.me/v2/bot";

function token(): string {
  const t = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!t) throw new Error("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN");
  return t;
}

// LINE ส่ง message สูงสุด 5000 ตัวอักษรต่อข้อความ
export function clip(text: string, max = 5000): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function textMessage(text: string) {
  return { type: "text", text: clip(text) };
}

// ตรวจว่า request มาจาก LINE จริง: HMAC-SHA256(channel secret, body) ต้องตรงกับ header x-line-signature
export function verifySignature(body: string, signature: string | null): Promise<boolean> {
  return verifySignatureWith(Deno.env.get("LINE_CHANNEL_SECRET"), body, signature);
}

// แยกออกมาให้บอทตัวอื่น (เช่น team-bot ที่ใช้ LINE OA คนละตัว) ส่ง channel secret ของตัวเองได้
export async function verifySignatureWith(secret: string | undefined, body: string, signature: string | null): Promise<boolean> {
  if (!secret || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = btoa(String.fromCharCode(...mac));

  // เทียบแบบเวลาคงที่ กันการเดาทีละตัวอักษรจากเวลาตอบสนอง
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function call(path: string, payload: unknown): Promise<Response> {
  return await callWith(token(), path, payload);
}

export async function callWith(accessToken: string, path: string, payload: unknown): Promise<Response> {
  return await fetch(`${LINE_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}

// คืน true ถ้าส่งสำเร็จ (replyToken หมดอายุ/ใช้ไปแล้วจะได้ false)
export async function reply(replyToken: string, messages: object[]): Promise<boolean> {
  const res = await call("/message/reply", { replyToken, messages });
  if (!res.ok) console.error("LINE reply failed", res.status, await res.text());
  return res.ok;
}

export async function push(to: string, messages: object[]): Promise<boolean> {
  const res = await call("/message/push", { to, messages });
  if (!res.ok) console.error("LINE push failed", res.status, await res.text());
  return res.ok;
}

// ใช้ reply ก่อนเสมอ ถ้า replyToken ใช้ไม่ได้แล้ว (เช่น AI ตอบช้า) ค่อย push แทน
export async function replyOrPush(replyToken: string | undefined, to: string, messages: object[]): Promise<boolean> {
  if (replyToken && await reply(replyToken, messages)) return true;
  return await push(to, messages);
}

// แสดงจุด "กำลังพิมพ์..." ในแชทลูกค้าระหว่างรอ AI (ฟรี ไม่นับโควตา)
export async function showLoading(chatId: string, seconds = 20): Promise<void> {
  await call("/chat/loading/start", { chatId, loadingSeconds: seconds }).catch(() => {});
}

export async function getDisplayName(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${LINE_API}/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!res.ok) return null;
    const p = await res.json();
    return p.displayName ?? null;
  } catch {
    return null;
  }
}
