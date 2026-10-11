// สรุปแชทของเมื่อวาน (เวลาไทย) ส่งให้เจ้าของทาง LINE — pg_cron เรียกทุกวัน 9:00 น.
import { push, textMessage } from "../_shared/line.ts";
import { db, ownerId } from "../_shared/db.ts";

Deno.serve(async (req) => {
  // รับเฉพาะ cron ที่ถือรหัสลับใน Vault
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: valid } = await db.rpc("chatbot_verify_cron_secret", { p_secret: secret });
  if (!valid) return new Response("Unauthorized", { status: 401 });

  const owner = ownerId();
  if (!owner) return new Response("OWNER_LINE_USER_ID not set", { status: 500 });

  // ช่วงเวลา = 00:00–24:00 ของเมื่อวานตามเวลาไทย (UTC+7)
  const BKK = 7 * 3600_000;
  const todayBkk = new Date(Date.now() + BKK);
  todayBkk.setUTCHours(0, 0, 0, 0);
  const end = new Date(todayBkk.getTime() - BKK);
  const start = new Date(end.getTime() - 24 * 3600_000);
  const dateLabel = new Date(start.getTime() + BKK).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });

  const { data: logs, error } = await db
    .from("chat_logs")
    .select("line_user_id, replied_by, missing_info, ai_cost_usd")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (error) return new Response(error.message, { status: 500 });

  // ค่าเฉลี่ย 7 วันล่าสุด ไว้ประมาณว่าเครดิตจะหมดเมื่อไหร่
  const { data: week } = await db
    .from("chat_logs")
    .select("ai_cost_usd")
    .gte("created_at", new Date(end.getTime() - 7 * 24 * 3600_000).toISOString())
    .lt("created_at", end.toISOString());
  const sumCost = (rows: { ai_cost_usd: number | string | null }[]) =>
    rows.reduce((s, r) => s + Number(r.ai_cost_usd ?? 0), 0);

  // ผู้ช่วย AI ส่วนตัวของเจ้าของ (_shared/assistant.ts) — นับรวมในค่า AI ด้วย
  const { data: assistantWeek } = await db
    .from("assistant_messages")
    .select("created_at, ai_cost_usd")
    .eq("role", "assistant")
    .gte("created_at", new Date(end.getTime() - 7 * 24 * 3600_000).toISOString())
    .lt("created_at", end.toISOString());
  const assistantYesterday = (assistantWeek ?? []).filter((r) => Date.parse(r.created_at) >= start.getTime());

  const { count: pendingNow } = await db
    .from("pending_approvals")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "awaiting_owner_reply"]);

  const rows = logs ?? [];
  const customers = new Set(rows.map((r) => r.line_user_id)).size;
  const byAi = rows.filter((r) => r.replied_by === "ai").length;
  const escalated = rows.filter((r) => r.replied_by !== "ai").length;

  const missing = new Map<string, number>();
  for (const r of rows) {
    const topic = r.missing_info?.trim();
    if (topic) missing.set(topic, (missing.get(topic) ?? 0) + 1);
  }
  const topMissing = [...missing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const assistantCost = sumCost(assistantYesterday);
  const costYesterday = sumCost(rows) + assistantCost;
  const avgPerDay = (sumCost(week ?? []) + sumCost(assistantWeek ?? [])) / 7;
  const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

  const lines = [
    `📊 สรุปแชท LINE วันที่ ${dateLabel}`,
    "",
    `💬 ข้อความทั้งหมด: ${rows.length} (ลูกค้า ${customers} คน)`,
    `🤖 AI ตอบเอง: ${byAi}`,
    `🙋 ส่งให้แอดมิน: ${escalated}`,
    `⏳ ยังรออนุมัติตอนนี้: ${pendingNow ?? 0} รายการ`,
    "",
    "❓ คำถามที่ไม่มีข้อมูลบ่อยที่สุด:",
    ...(topMissing.length
      ? topMissing.map(([topic, n], i) => `${i + 1}. ${topic} (${n} ครั้ง)`)
      : ["- ไม่มี 🎉"]),
  ];
  if (topMissing.length) lines.push("", "เพิ่มข้อมูลได้ที่ thecardlistbkk.com/admin/chatbot/knowledge");
  lines.push(
    "",
    `💰 ค่า AI เมื่อวาน: ${usd(costYesterday)} (โดยประมาณ)`,
    ...(assistantYesterday.length
      ? [`   รวมผู้ช่วย AI ส่วนตัว ${assistantYesterday.length} ข้อความ: ${usd(assistantCost)}`]
      : []),
    `📈 เฉลี่ย 7 วัน: ${usd(avgPerDay)}/วัน ≈ ${usd(avgPerDay * 30)}/เดือน`,
    "เช็กเครดิตคงเหลือ: console.anthropic.com/settings/billing",
  );

  const ok = await push(owner, [textMessage(lines.join("\n"))]);
  return new Response(ok ? "sent" : "push failed", { status: ok ? 200 : 502 });
});
