// งานจริงของ webhook (index.ts โหลดไฟล์นี้หลังตอบ LINE ไปแล้ว)
// 3. ลูกค้า: AI ตอบได้ → reply / ต้องให้แอดมินดู → reply "รอแอดมิน" + push การ์ดหาเจ้าของ
// 4. เจ้าของ: กด "อนุมัติ" → push คำตอบให้ลูกค้า / กด "ตอบเอง" → ข้อความถัดไปของเจ้าของจะถูกส่งให้ลูกค้า
// 5. เจ้าของพิมพ์อย่างอื่น → ผู้ช่วย AI ส่วนตัว (_shared/assistant.ts) / "ลูกค้า: ..." = ทดสอบเป็นลูกค้า
import { clip, getDisplayName, push, reply, replyOrPush, showLoading, textMessage } from "../_shared/line.ts";
import { AiUsage, decide, HistoryTurn, mustEscalate } from "../_shared/ai.ts";
import { db, ownerId, waitMessageFor } from "../_shared/db.ts";
import { askAssistant, isAssistantUser } from "../_shared/assistant.ts";

// deno-lint-ignore no-explicit-any
type LineEvent = any;

export async function handleEvents(events: LineEvent[]) {
  await Promise.all(events.map((e) => handleEvent(e).catch((err) => console.error("event failed", err))));
}

async function handleEvent(e: LineEvent) {
  const userId: string | undefined = e.source?.userId;
  if (!userId || e.source?.type !== "user") return; // ตอบเฉพาะแชท 1:1 ไม่ตอบในกลุ่ม

  // LINE อาจส่ง event ซ้ำถ้าครั้งแรกตอบช้า — ข้ามถ้าเคยบันทึกแล้ว
  if (e.deliveryContext?.isRedelivery && e.webhookEventId) {
    const { data } = await db.from("chat_logs").select("id").eq("webhook_event_id", e.webhookEventId).maybeSingle();
    if (data) return;
  }

  const isOwner = userId === ownerId();

  if (e.type === "postback" && isOwner) return await handleOwnerPostback(e);
  if (e.type !== "message") return;

  if (e.message.type === "text") {
    const text: string = e.message.text.trim();

    // ให้เจ้าของ (หรือใครก็ได้) หา LINE user ID ของตัวเองไว้ใส่ OWNER_LINE_USER_ID
    if (text.toLowerCase() === "myid") {
      await reply(e.replyToken, [textMessage(`LINE user ID ของคุณคือ\n${userId}`)]);
      return;
    }

    if (isOwner && await handleOwnerText(e, text)) return;

    // เจ้าของ = คุยกับผู้ช่วย AI ส่วนตัว (ทดสอบบอทลูกค้าได้ด้วยการพิมพ์ "ลูกค้า: คำถาม")
    if (isAssistantUser(userId)) {
      const asCustomer = text.match(/^ลูกค้า\s*[:：]\s*([\s\S]+)/);
      if (asCustomer) return await handleCustomerText(e, userId, asCustomer[1].trim());
      return await handleAssistantText(e, userId, text);
    }
    return await handleCustomerText(e, userId, text);
  }

  // รูป/ไฟล์ (มักเป็นสลิปโอนเงิน) ให้แอดมินดูเสมอ — สติกเกอร์ไม่ต้องตอบ
  if (["image", "file", "video", "audio"].includes(e.message.type)) {
    const label = { image: "รูปภาพ", file: "ไฟล์", video: "วิดีโอ", audio: "ข้อความเสียง" }[e.message.type as string];
    return await escalate(e, userId, await getDisplayName(userId), `[ลูกค้าส่ง${label}]`, {
      draft: `ได้รับ${label}เรียบร้อยครับ แอดมินจะตรวจสอบและแจ้งกลับโดยเร็วที่สุดนะครับ`,
      reason: `ลูกค้าส่ง${label} (อาจเป็นสลิป) — เปิดดูใน LINE OA Manager`,
      missing: null,
    });
  }
}

// ── ผู้ช่วย AI ส่วนตัว ──────────────────────────────────────────────────────
async function handleAssistantText(e: LineEvent, userId: string, text: string) {
  await showLoading(userId, 60);
  let answer: string;
  try {
    answer = await askAssistant(userId, text, "customer");
  } catch (err) {
    console.error("assistant failed", err);
    answer = "ขอโทษครับ ระบบ AI ขัดข้อง ลองพิมพ์ใหม่อีกครั้งนะครับ";
  }
  await replyOrPush(e.replyToken, userId, [textMessage(answer)]);
}

// ── ลูกค้า ─────────────────────────────────────────────────────────────────
async function handleCustomerText(e: LineEvent, userId: string, text: string) {
  await showLoading(userId);

  const [displayName, knowledge, products, history] = await Promise.all([
    getDisplayName(userId),
    db.from("knowledge").select("title, category, content").eq("active", true).order("category").then((r) => r.data ?? []),
    // อ่านสดทุกครั้ง ราคา/สต็อกจะตรงกับหน้าเว็บเสมอ (เฉพาะสินค้าที่เปิดขาย)
    db.from("products").select("name, sub, category, tcg, price, stock, badge, description").eq("active", true).order("name").then((r) => r.data ?? []),
    recentHistory(userId),
  ]);

  let decision, usage: AiUsage;
  try {
    ({ decision, usage } = await decide(text, knowledge, products, history));
  } catch (err) {
    console.error("AI failed", err);
    return await escalate(e, userId, displayName, text, {
      draft: "",
      reason: "AI ทำงานผิดพลาด — กรุณาตอบเอง",
      missing: null,
    });
  }

  const forced = mustEscalate(text);
  if (decision.action === "answer" && !forced) {
    await replyOrPush(e.replyToken, userId, [textMessage(decision.answer)]);
    await db.from("chat_logs").insert({
      line_user_id: userId,
      display_name: displayName,
      message: text,
      reply: decision.answer,
      replied_by: "ai",
      missing_info: decision.missing_info || null,
      webhook_event_id: e.webhookEventId ?? null,
      ...usage,
    });
    return;
  }

  await escalate(e, userId, displayName, text, {
    draft: decision.answer,
    reason: decision.reason || (forced ? "มีคำที่ต้องให้แอดมินตรวจสอบ (ราคา/จอง/ชำระเงิน/ร้องเรียน)" : "AI ไม่มั่นใจ"),
    missing: decision.missing_info || null,
    usage,
  });
}

async function recentHistory(userId: string): Promise<HistoryTurn[]> {
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data } = await db
    .from("chat_logs")
    .select("message, reply")
    .eq("line_user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []).reverse();
}

async function escalate(
  e: LineEvent,
  userId: string,
  displayName: string | null,
  question: string,
  opts: { draft: string; reason: string; missing: string | null; usage?: AiUsage },
) {
  // บอก "รอแอดมิน" ครั้งเดียว — ถ้ายังมีคำถามที่แอดมินยังไม่ตอบ (ภายใน 12 ชม.) ไม่ต้องบอกซ้ำ
  const since = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { count: waiting } = await db
    .from("pending_approvals")
    .select("id", { count: "exact", head: true })
    .eq("line_user_id", userId)
    .in("status", ["pending", "awaiting_owner_reply"])
    .gte("created_at", since);
  if (!waiting) await replyOrPush(e.replyToken, userId, [textMessage(waitMessageFor(question))]);

  const { data: log } = await db.from("chat_logs").insert({
    line_user_id: userId,
    display_name: displayName,
    message: question,
    reply: null,
    replied_by: "pending",
    escalation_reason: opts.reason,
    missing_info: opts.missing,
    webhook_event_id: e.webhookEventId ?? null,
    ...opts.usage,
  }).select("id").single();

  const { data: pending, error } = await db.from("pending_approvals").insert({
    chat_log_id: log?.id ?? null,
    line_user_id: userId,
    display_name: displayName,
    question,
    draft_answer: opts.draft,
    reason: opts.reason,
  }).select("id").single();
  if (error || !pending) return console.error("insert pending failed", error);

  const owner = ownerId();
  if (owner) await push(owner, [approvalCard(pending.id, displayName ?? "ลูกค้า", question, opts.draft, opts.reason)]);
}

function approvalCard(id: string, name: string, question: string, draft: string, reason: string) {
  const buttons: object[] = [];
  if (draft) {
    buttons.push({
      type: "button", style: "primary", color: "#16a34a", height: "sm",
      action: { type: "postback", label: "อนุมัติ", data: `action=approve&id=${id}`, displayText: "อนุมัติ" },
    });
  }
  buttons.push({
    type: "button", style: "secondary", height: "sm",
    action: { type: "postback", label: "ตอบเอง", data: `action=manual&id=${id}`, displayText: "ตอบเอง" },
  });

  const section = (label: string, value: string, color = "#111111") => ({
    type: "box", layout: "vertical", spacing: "xs", contents: [
      { type: "text", text: label, size: "xs", color: "#888888" },
      { type: "text", text: clip(value || "-", 1500), size: "sm", wrap: true, color },
    ],
  });

  return {
    type: "flex",
    altText: `รออนุมัติ: ${clip(question, 60)}`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#111111", contents: [
          { type: "text", text: "🔔 คำถามรออนุมัติ", color: "#ffffff", weight: "bold" },
          { type: "text", text: name, color: "#bbbbbb", size: "xs" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "md", contents: [
          section("ลูกค้าถาม", question),
          section("เหตุผล", reason, "#b45309"),
          section("ร่างคำตอบ", draft || "(ไม่มีร่าง กรุณาตอบเอง)", "#1d4ed8"),
        ],
      },
      footer: { type: "box", layout: "horizontal", spacing: "sm", contents: buttons },
    },
  };
}

// ── เจ้าของ ────────────────────────────────────────────────────────────────
async function handleOwnerPostback(e: LineEvent) {
  const params = new URLSearchParams(e.postback.data);
  const id = params.get("id");
  const action = params.get("action");
  if (!id) return;

  const { data: item } = await db.from("pending_approvals").select("*").eq("id", id).maybeSingle();
  if (!item) return await reply(e.replyToken, [textMessage("ไม่พบรายการนี้แล้วครับ")]);
  if (item.status === "sent" || item.status === "dismissed") {
    return await reply(e.replyToken, [textMessage("รายการนี้จัดการไปแล้วครับ")]);
  }

  if (action === "approve") {
    const ok = await sendToCustomer(item.id, item.draft_answer, "owner (LINE)");
    return await reply(e.replyToken, [
      textMessage(ok ? `✅ ส่งคำตอบให้ ${item.display_name ?? "ลูกค้า"} แล้ว` : "❌ ส่งไม่สำเร็จ ลองใหม่อีกครั้งหรือตอบผ่านหน้าเว็บแอดมิน"),
    ]);
  }

  if (action === "manual") {
    // รอคำตอบได้ทีละรายการ — รายการอื่นที่ค้าง "ตอบเอง" อยู่ให้กลับไปเป็นรออนุมัติ
    await db.from("pending_approvals").update({ status: "pending" }).eq("status", "awaiting_owner_reply").neq("id", id);
    await db.from("pending_approvals").update({ status: "awaiting_owner_reply" }).eq("id", id);
    return await reply(e.replyToken, [
      textMessage(`พิมพ์คำตอบสำหรับ ${item.display_name ?? "ลูกค้า"} ได้เลยครับ\nข้อความถัดไปของคุณจะถูกส่งให้ลูกค้าทันที\n\n(พิมพ์ "ยกเลิก" ถ้าไม่ต้องการตอบตอนนี้)`),
    ]);
  }
}

// คืน true ถ้าข้อความนี้เป็นคำตอบ "ตอบเอง" (ไม่ต้องส่งเข้า AI)
async function handleOwnerText(e: LineEvent, text: string): Promise<boolean> {
  const { data: item } = await db
    .from("pending_approvals")
    .select("id, display_name")
    .eq("status", "awaiting_owner_reply")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!item) return false; // ไม่มีงานค้าง → เจ้าของคุยกับบอทเหมือนลูกค้า (ใช้ทดสอบได้)

  if (text === "ยกเลิก") {
    await db.from("pending_approvals").update({ status: "pending" }).eq("id", item.id);
    await reply(e.replyToken, [textMessage("ยกเลิกแล้ว รายการยังอยู่ในหน้ารออนุมัติครับ")]);
    return true;
  }

  const ok = await sendToCustomer(item.id, text, "owner (LINE)");
  await reply(e.replyToken, [
    textMessage(ok ? `✅ ส่งให้ ${item.display_name ?? "ลูกค้า"} แล้ว` : "❌ ส่งไม่สำเร็จ ลองใหม่อีกครั้งครับ"),
  ]);
  return true;
}

// push คำตอบให้ลูกค้า (นับโควตา) — จองรายการก่อนส่ง กันกดซ้ำแล้วลูกค้าได้ 2 ข้อความ
async function sendToCustomer(pendingId: string, answer: string, handledBy: string): Promise<boolean> {
  const { data: claimed } = await db
    .from("pending_approvals")
    .update({ status: "sent", final_answer: answer, handled_by: handledBy, handled_at: new Date().toISOString() })
    .eq("id", pendingId)
    .in("status", ["pending", "awaiting_owner_reply"])
    .select("line_user_id, chat_log_id")
    .maybeSingle();
  if (!claimed) return false;

  const ok = await push(claimed.line_user_id, [textMessage(answer)]);
  if (!ok) {
    await db.from("pending_approvals").update({ status: "pending", final_answer: null, handled_by: null, handled_at: null }).eq("id", pendingId);
    return false;
  }
  if (claimed.chat_log_id) {
    await db.from("chat_logs").update({ reply: answer, replied_by: "admin" }).eq("id", claimed.chat_log_id);
  }
  return true;
}
