// โหมดผู้ช่วย AI ส่วนตัว — คุยได้ทุกเรื่องเหมือนคุยกับ Claude (ใช้ได้ทั้งบอทลูกค้าและบอททีม ในแชทส่วนตัว)
// ใครใช้ได้: OWNER_LINE_USER_ID + ASSISTANT_LINE_USER_IDS (คั่นด้วย ,) — ทั้งสอง OA อยู่ provider เดียวกัน user ID จึงตรงกัน
// จำบทสนทนาในตาราง assistant_messages (ใช้ร่วมกันทั้งสองบอท) / พิมพ์ "เริ่มใหม่" เพื่อล้าง
// รู้ข้อมูลร้าน (knowledge) + สินค้า/สต็อกบนเว็บ + งานค้างของทีม และค้นเว็บได้ (web search)
import Anthropic from "npm:@anthropic-ai/sdk";
import { db, ownerId } from "./db.ts";

const RESET = /^(เริ่มใหม่|ล้างแชท|ลืม|reset|new chat)$/i;
const HISTORY_LIMIT = 20; // ข้อความล่าสุดที่ส่งให้ AI
const HISTORY_DAYS = 3;
const WEB_SEARCH_USD = 0.01; // $10 ต่อ 1,000 ครั้ง

// ราคา USD ต่อ 1 ล้าน token (ตรงกับ _shared/ai.ts)
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

const INSTRUCTIONS = `คุณคือ Claude ผู้ช่วย AI ส่วนตัวของเจ้าของร้าน The Cardlist (ร้านการ์ดเกม TCG และผู้จัดงานแข่งในกรุงเทพฯ) คุยผ่าน LINE
- ช่วยได้ทุกเรื่องเหมือนผู้ช่วยทั่วไป: ตอบคำถาม เขียนแคปชัน/โพสต์/ประกาศ ร่างข้อความ แปลภาษา คิดไอเดีย วางแผน คำนวณ และเรื่องของร้าน
- ตอบภาษาเดียวกับที่ผู้ใช้พิมพ์มา (ส่วนใหญ่ภาษาไทย) เป็นกันเอง กระชับ อ่านง่ายบนมือถือ ยาวเท่าที่จำเป็น
- ห้ามใช้ markdown (LINE ไม่แสดง ** # หรือตาราง) ใช้ขึ้นบรรทัดใหม่ ขีด - หรืออิโมจินำหน้าแทน
- ข้อมูลร้านด้านล่างเป็นข้อมูลจริงล่าสุด ใช้ตอบเรื่องร้านได้ ถ้าไม่มีข้อมูลให้บอกตรงๆ ห้ามเดาตัวเลข
- เรื่องที่ต้องใช้ข้อมูลล่าสุดจากอินเทอร์เน็ต (ข่าว ราคาตลาด วันวางจำหน่าย กติกาใหม่) ให้ค้นเว็บก่อนตอบ และบอกแหล่งที่มาสั้นๆ
- คุณทำได้แค่คุยและให้ข้อมูล แก้ไขข้อมูลร้าน สั่งงาน หรือส่งข้อความหาคนอื่นเองไม่ได้ ถ้าผู้ใช้ขอ ให้บอกวิธีทำ (เช่น สั่งงานในบอท Cardlist Manager ด้วย "ให้ Nic ทำ...")`;

export function isAssistantUser(userId: string | undefined): boolean {
  if (!userId) return false;
  const ids = [ownerId(), ...(Deno.env.get("ASSISTANT_LINE_USER_IDS") ?? "").split(",")].map((s) => s?.trim()).filter(Boolean);
  return ids.includes(userId);
}

const client = new Anthropic(); // อ่าน ANTHROPIC_API_KEY จาก env

// คืนข้อความตอบกลับ (ตัดให้ไม่เกินที่ LINE รับได้แล้ว)
export async function askAssistant(userId: string, text: string, bot: "customer" | "team"): Promise<string> {
  if (RESET.test(text.trim())) {
    await db.from("assistant_messages").update({ cleared: true }).eq("line_user_id", userId).eq("cleared", false);
    return "🧹 ล้างบทสนทนาแล้วครับ เริ่มคุยเรื่องใหม่ได้เลย";
  }

  const [history, shopBlock, liveBlock] = await Promise.all([loadHistory(userId), shopKnowledge(), liveData()]);
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: text }];

  // deno-lint-ignore no-explicit-any
  const params: any = {
    model: Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // ถ้าโมเดลหลักปฏิเสธ ให้ API ลองโมเดลสำรองอัตโนมัติ
    output_config: { effort: "medium" },
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5, user_location: { type: "approximate", country: "TH", timezone: "Asia/Bangkok" } }],
    system: [
      { type: "text", text: INSTRUCTIONS },
      // ข้อมูลร้านเปลี่ยนไม่บ่อย — cache ไว้
      { type: "text", text: shopBlock, cache_control: { type: "ephemeral" } },
      // เวลา/สต็อก/งานค้าง เปลี่ยนทุกครั้ง จึงอยู่หลังจุด cache
      { type: "text", text: liveBlock },
    ],
    messages,
  };

  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 };
  let res: Anthropic.Beta.BetaMessage | undefined;
  // server tool (web search) อาจหยุดกลางทาง (pause_turn) — ส่งต่อให้ทำต่อ สูงสุด 3 รอบ
  for (let i = 0; i < 4; i++) {
    res = await client.beta.messages.create(params) as Anthropic.Beta.BetaMessage;
    // deno-lint-ignore no-explicit-any
    const u: any = res.usage ?? {};
    usage.input += u.input_tokens ?? 0;
    usage.output += u.output_tokens ?? 0;
    usage.cacheRead += u.cache_read_input_tokens ?? 0;
    usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
    usage.searches += u.server_tool_use?.web_search_requests ?? 0;
    if (res.stop_reason !== "pause_turn") break;
    params.messages = [...messages, { role: "assistant", content: res.content }];
  }

  let answer: string;
  if (!res || res.stop_reason === "refusal") answer = "ขอโทษครับ เรื่องนี้ผมช่วยไม่ได้ ลองถามแบบอื่นได้ไหมครับ";
  else answer = finalText(res.content) || "ขอโทษครับ ตอบไม่สำเร็จ ลองพิมพ์ใหม่อีกครั้งนะครับ";
  if (res?.stop_reason === "max_tokens") answer += "\n\n(คำตอบยาวเกินไป ถูกตัดตรงนี้ — พิมพ์ \"ต่อ\" ได้ครับ)";

  const model = res?.model ?? params.model;
  const price = PRICES[model];
  const cost = price
    ? (usage.input * price.input + usage.output * price.output + usage.cacheRead * price.cacheRead +
      usage.cacheWrite * price.cacheWrite) / 1_000_000 + usage.searches * WEB_SEARCH_USD
    : null;

  await db.from("assistant_messages").insert([
    { line_user_id: userId, bot, role: "user", content: text },
    {
      line_user_id: userId, bot, role: "assistant", content: answer, ai_model: model,
      input_tokens: usage.input, output_tokens: usage.output, cache_read_tokens: usage.cacheRead,
      cache_write_tokens: usage.cacheWrite, web_searches: usage.searches, ai_cost_usd: cost,
    },
  ]);
  return answer.length > 4900 ? answer.slice(0, 4890) + "…" : answer;
}

// ข้อความสุดท้ายของคำตอบ (หลังผลค้นเว็บ ถ้ามี) + เก็บกวาด markdown ที่หลุดมา
function finalText(content: Anthropic.Beta.BetaContentBlock[]): string {
  let start = 0;
  content.forEach((b, i) => { if (b.type !== "text") start = i + 1; });
  const pick = content.slice(start).filter((b) => b.type === "text");
  const blocks = pick.length ? pick : content.filter((b) => b.type === "text");
  return blocks.map((b) => (b as Anthropic.Beta.BetaTextBlock).text).join("")
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").trim();
}

async function loadHistory(userId: string): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
  const { data } = await db.from("assistant_messages").select("role, content")
    .eq("line_user_id", userId).eq("cleared", false).gte("created_at", since)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(HISTORY_LIMIT);
  const rows = (data ?? []).reverse();
  // ต้องเริ่มด้วย user และสลับ user/assistant — รวมข้อความติดกันที่ role เดียวกัน
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const r of rows) {
    if (!out.length && r.role !== "user") continue;
    const last = out[out.length - 1];
    if (last && last.role === r.role) last.content += `\n\n${r.content}`;
    else out.push({ role: r.role, content: r.content });
  }
  if (out.length && out[out.length - 1].role === "user") out.pop(); // คำถามที่ยังไม่มีคำตอบ (เช่น error) ไม่ต้องส่งซ้ำ
  return out;
}

async function shopKnowledge(): Promise<string> {
  const { data } = await db.from("knowledge").select("title, category, content").eq("active", true).order("category").order("title");
  const items = (data ?? []).map((r) => `<หัวข้อ หมวด="${r.category}" ชื่อ="${r.title}">\n${r.content}\n</หัวข้อ>`).join("\n");
  return `<ข้อมูลร้าน>\n${items || "(ยังไม่มีข้อมูล)"}\n</ข้อมูลร้าน>`;
}

async function liveData(): Promise<string> {
  const [{ data: products }, { data: tasks }] = await Promise.all([
    db.from("products").select("name, price, stock, active").order("name"),
    db.from("tasks").select("id, title, due_at, assignee:team_members!tasks_assignee_id_fkey(nickname, display_name)")
      .eq("status", "open").order("due_at", { ascending: true, nullsFirst: false }).limit(50),
  ]);
  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "full", timeStyle: "short" });
  const productLines = (products ?? []).map((p) =>
    `- ${p.name} | ${Number(p.price).toLocaleString("en-US")} บาท | สต็อก ${p.stock}${p.active ? "" : " | ไม่ได้เปิดขายบนเว็บ"}`
  ).join("\n");
  const taskLines = (tasks ?? []).map((t) => {
    // deno-lint-ignore no-explicit-any
    const a: any = t.assignee;
    const due = t.due_at ? new Date(t.due_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) : "ไม่กำหนด";
    return `- #${t.id} ${t.title} | ${a?.nickname || a?.display_name || "ยังไม่มีคนรับ"} | กำหนด ${due}`;
  }).join("\n");
  return `<เวลาตอนนี้>${now}</เวลาตอนนี้>
<สินค้าบนเว็บ (สต็อกซิงก์จาก Loyverse ทุก 15 นาที)>
${productLines || "(ไม่มี)"}
</สินค้าบนเว็บ>
<งานค้างของทีม>
${taskLines || "(ไม่มีงานค้าง)"}
</งานค้างของทีม>`;
}
