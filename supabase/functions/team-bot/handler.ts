// บอทสั่งงานทีมในกลุ่ม LINE ที่ทำงาน
//
// บอทได้รับทุกข้อความในกลุ่ม แต่ "ทำงาน" เฉพาะ:
//   - คำสั่งสั้น: วิธีใช้ / ลงชื่อ <ชื่อเล่น> / งานค้าง / งานของฉัน / เสร็จ #N / ยกเลิก #N / ตั้งหัวหน้า @คน / ตั้ง HR @คน
//                 เข้างาน / เลิกงาน / แจ้งสาย|ป่วย|ขาด … / กะวันนี้ / กะพรุ่งนี้ / กะของฉัน
//   - ข้อความที่ @แท็กบอท → ให้ AI แยกเป็นงาน (หัวหน้า) และ/หรือ การตั้งกะ (หัวหน้า/HR)
// ข้อความอื่นถูกทิ้งทันที ไม่บันทึก ไม่ส่งให้ AI
// แชทส่วนตัวกับบอท: เจ้าของ/หัวหน้า/HR ใช้คำสั่งเดียวกันได้โดยไม่ต้องแท็ก (งานที่สั่งจะแจ้งในกลุ่มให้ด้วย)
// เจ้าของ (isAssistantUser) แชทส่วนตัวเรื่องอื่นที่ไม่ใช่สั่งงาน/จัดกะ → ผู้ช่วย AI ส่วนตัว (_shared/assistant.ts)
import { db, ownerId } from "../_shared/db.ts";
import {
  formatDue, groupMemberName, Member, memberName, mentionText, openTasks, taskLines, teamGroupId, teamPush, teamReply,
  teamShowLoading,
} from "../_shared/team.ts";
import { askAssistant, isAssistantUser } from "../_shared/assistant.ts";
import { textMessage } from "../_shared/line.ts";
import {
  attendanceEnabled, bkkDate, bkkTime, fmtDate, fmtTime, LATE_AFTER_MINUTES, NOTICE_LABEL, noticesOn, shiftLabel, shiftsOn, staff,
} from "../_shared/hr.ts";
import { parseMessage } from "./ai.ts";

// deno-lint-ignore no-explicit-any
type LineEvent = any;

const HELP = `🤖 วิธีใช้บอทสั่งงาน

สั่งงาน (เฉพาะหัวหน้า)
@บอท ให้ @ต้น เตรียมโต๊ะแข่งวันเสาร์ก่อนบ่ายโมง

คำสั่งสั้น (ไม่ต้องแท็กบอท)
• งานค้าง — งานที่ยังไม่เสร็จทั้งหมด
• งานของฉัน — งานที่ฉันรับผิดชอบ
• เสร็จ #12 — ปิดงาน (คนรับงานหรือหัวหน้า)
• ยกเลิก #12 — ยกเลิกงาน (หัวหน้า)
• ลงชื่อ ต้น — ตั้งชื่อเล่นให้บอทรู้จัก
• ตั้งเจ้าของ / ตั้งหัวหน้า / ตั้ง HR @ชื่อ — กำหนดบทบาท (เจ้าของ)

เวลาทำงาน
• เข้างาน / เลิกงาน — ลงเวลา
• แจ้งสาย 30 นาที รถติด
• แจ้งป่วย ไม่สบาย / แจ้งขาด ติดธุระ (ใส่ "พรุ่งนี้" ได้)
• กะวันนี้ / กะพรุ่งนี้ / กะของฉัน

จัดกะ (หัวหน้า/HR)
@บอท ต้นหยุดวันศุกร์นี้
@บอท มิวเข้า 13:00–22:00 จันทร์–พุธ`;

// ซ่อนคำสั่งลงเวลาออกจากวิธีใช้ ถ้ายังไม่เปิดฟังก์ชันนี้
function help(): string {
  return attendanceEnabled() ? HELP : HELP.replace("• เข้างาน / เลิกงาน — ลงเวลา\n", "");
}

export async function handleEvents(events: LineEvent[]) {
  await Promise.all(events.map((e) => handleEvent(e).catch((err) => console.error("event failed", err))));
}

async function handleEvent(e: LineEvent) {
  // ใช้ได้ 2 ที่: กลุ่มที่ทำงาน (ทุกคน) และแชทส่วนตัวกับบอท (เฉพาะเจ้าของ/หัวหน้า/HR)
  const isPrivate = e.source?.type === "user";
  if (!isPrivate && e.source?.type !== "group") return;
  const groupId: string | null = isPrivate ? teamGroupId() : e.source.groupId;
  if (!groupId) return;

  if (e.type === "join") {
    const ready = teamGroupId() === groupId;
    return await teamReply(e.replyToken, [textMessage(
      ready ? help() : "สวัสดีครับ 👋 ให้เจ้าของพิมพ์ groupid เพื่อเอารหัสกลุ่มไปตั้งค่าบอทก่อนนะครับ",
    )]);
  }
  if (e.type !== "message" || e.message.type !== "text") return;

  const userId: string | undefined = e.source.userId;
  const raw: string = e.message.text;

  // ใช้ตอนตั้งค่าครั้งแรก: เอารหัสกลุ่มไปใส่ TEAM_GROUP_ID
  if (!isPrivate && raw.trim().toLowerCase() === "groupid") {
    return await teamReply(e.replyToken, [textMessage(`รหัสกลุ่มนี้คือ\n${groupId}`)]);
  }

  // ทำงานเฉพาะกลุ่มที่ตั้งค่าไว้ — ถ้ามีคนเชิญบอทไปกลุ่มอื่น บอทจะเงียบ
  if (!userId || teamGroupId() !== groupId) return;

  // แชทส่วนตัว: เฉพาะเจ้าของ/หัวหน้า/HR ที่อยู่ในทีมแล้ว
  if (isPrivate) {
    const { data: who } = await db.from("team_members").select("role, line_user_id").eq("line_user_id", userId).maybeSingle();
    const allowed = userId === ownerId() || (who && ["owner", "manager", "hr"].includes(who.role));
    if (!allowed) {
      return await teamReply(e.replyToken, [textMessage("แชทส่วนตัวใช้ได้เฉพาะเจ้าของ หัวหน้า และ HR ครับ\nพิมพ์คำสั่งในกลุ่มงานได้เลย 🙏")]);
    }
  }

  const mentionees: { index: number; length: number; userId?: string; isSelf?: boolean }[] =
    e.message.mention?.mentionees ?? [];
  // แชทส่วนตัวไม่ต้องแท็กบอท — ทุกข้อความคือคำสั่ง
  const botMentioned = isPrivate || mentionees.some((m) => m.isSelf);
  const others = mentionees.filter((m) => !m.isSelf && m.userId);
  const text = stripBotMention(raw, mentionees).trim();

  const reply = (msg: object) => teamReply(e.replyToken, [msg]);
  const say = (s: string) => reply(textMessage(s));

  // ── คำสั่งสั้น (ไม่ใช้ AI) ──
  if (/^(วิธีใช้|ช่วยเหลือ|help)$/i.test(text)) return await say(help());

  const register = text.match(/^ลงชื่อ\s+(.{1,30})$/);
  if (register) {
    const me = await ensureMember(groupId, userId);
    await db.from("team_members").update({ nickname: register[1].trim() }).eq("id", me.id);
    return await say(`👋 บันทึกแล้ว เรียกคุณว่า "${register[1].trim()}" นะครับ`);
  }

  if (/^งานค้าง$/.test(text)) return await reply(listMessage("📋 งานค้าง", await openTasks(), isPrivate));

  if (/^งานของฉัน$/.test(text)) {
    const mine = (await openTasks()).filter((t) => t.assignee?.line_user_id === userId);
    return await reply(listMessage("📋 งานของคุณ", mine, isPrivate));
  }

  const done = text.match(/^(เสร็จ|เสร็จแล้ว|ปิดงาน|done)\s*#?(\d+)$/i);
  if (done) return await say(await closeTask(groupId, userId, Number(done[2]), "done"));

  const cancel = text.match(/^ยกเลิก(งาน)?\s*#(\d+)$/);
  if (cancel) return await say(await closeTask(groupId, userId, Number(cancel[2]), "cancelled"));

  if (/^ตั้งเจ้าของ/.test(text)) {
    if (!(await isOwnerUser(userId))) return await say("เฉพาะเจ้าของร้านตั้งเจ้าของได้ครับ");
    if (others.length === 0) return await say("แท็กคนที่จะตั้งเป็นเจ้าของด้วยครับ เช่น ตั้งเจ้าของ @ชื่อ");
    const names: string[] = [];
    for (const m of others) {
      const member = await ensureMember(groupId, m.userId!);
      await db.from("team_members").update({ role: "owner", tracks_attendance: false }).eq("id", member.id);
      names.push(memberName(member));
    }
    return await say(`👑 ตั้ง ${names.join(", ")} เป็นเจ้าของแล้ว ทำได้ทุกอย่างและไม่ต้องลงเวลาครับ`);
  }

  if (/^ตั้งหัวหน้า/.test(text)) {
    if (!(await isOwnerUser(userId))) return await say("เฉพาะเจ้าของร้านตั้งหัวหน้าได้ครับ");
    if (others.length === 0) return await say("แท็กคนที่จะตั้งเป็นหัวหน้าด้วยครับ เช่น ตั้งหัวหน้า @ต้น");
    const names: string[] = [];
    for (const m of others) {
      const member = await ensureMember(groupId, m.userId!);
      await db.from("team_members").update({ role: "manager" }).eq("id", member.id);
      names.push(memberName(member));
    }
    return await say(`⭐ ตั้ง ${names.join(", ")} เป็นหัวหน้าแล้ว สั่งงานได้ครับ`);
  }

  if (/^ตั้ง\s*HR/i.test(text)) {
    if (!(await isOwnerUser(userId))) return await say("เฉพาะเจ้าของร้านตั้ง HR ได้ครับ");
    if (others.length === 0) return await say("แท็กคนที่จะตั้งเป็น HR ด้วยครับ เช่น ตั้ง HR @มิว");
    const names: string[] = [];
    for (const m of others) {
      const member = await ensureMember(groupId, m.userId!);
      await db.from("team_members").update({ role: "hr" }).eq("id", member.id);
      names.push(memberName(member));
    }
    return await say(`🗂️ ตั้ง ${names.join(", ")} เป็น HR แล้ว จัดกะได้ครับ`);
  }

  // ── เวลาทำงาน (ไม่ใช้ AI) ──
  if (/^(เข้างาน|เลิกงาน)$/.test(text)) {
    if (!attendanceEnabled()) return; // ปิดอยู่ — ไม่บันทึก ไม่ตอบ
    const me = await ensureMember(groupId, userId);
    return await reply(text === "เข้างาน" ? await checkIn(me, isPrivate) : await checkOut(me, isPrivate));
  }

  const notice = text.match(/^แจ้ง(สาย|ป่วย|ขาด)\s*(.*)$/);
  if (notice) {
    const me = await ensureMember(groupId, userId);
    return await say(await addNotice(me, notice[1], notice[2].trim()));
  }

  const shiftDay = text.match(/^กะ(วันนี้|พรุ่งนี้)$/);
  if (shiftDay) return await say(await shiftsReport(bkkDate(Date.now(), shiftDay[1] === "พรุ่งนี้" ? 1 : 0)));

  if (/^กะของฉัน$/.test(text)) return await say(await myShifts(await ensureMember(groupId, userId)));

  // ── สั่งงาน / จัดกะ ด้วยภาษาคน (ใช้ AI) — ต้องแท็กบอท ──
  if (!botMentioned) return;

  const me = await ensureMember(groupId, userId);
  if (!isManager(me) && !isHR(me)) {
    return await say("ขอโทษครับ เฉพาะหัวหน้าและ HR เท่านั้นที่สั่งงานหรือจัดกะผ่านบอทได้ 🙏\nพิมพ์ วิธีใช้ เพื่อดูคำสั่งอื่น");
  }
  if (!text) return await say(help());

  // คนที่ถูกแท็กในข้อความ ลงทะเบียนอัตโนมัติ (ได้ชื่อจากกลุ่ม)
  const mentioned: Member[] = [];
  for (const m of others) mentioned.push(await ensureMember(groupId, m.userId!));

  const { data: allMembers } = await db
    .from("team_members").select("id, line_user_id, nickname, display_name, role").eq("active", true);
  const members = (allMembers ?? []) as Member[];

  // เจ้าของในแชทส่วนตัว: ถ้าไม่ใช่การสั่งงาน/จัดกะ → คุยกับผู้ช่วย AI ส่วนตัวแทน
  const assistantMode = isPrivate && isAssistantUser(userId);
  if (assistantMode) await teamShowLoading(userId, 60);

  let parsed;
  try {
    parsed = await parseMessage(text, members, mentioned);
  } catch (err) {
    console.error("AI parse failed", err);
    if (!assistantMode) return await say("ขอโทษครับ ระบบ AI ขัดข้อง ลองสั่งใหม่อีกครั้ง หรือเพิ่มงานผ่านหน้าเว็บแอดมินได้ครับ");
    parsed = { tasks: [], shifts: [], reply: "" };
  }
  if (parsed.tasks.length === 0 && parsed.shifts.length === 0) {
    if (assistantMode) {
      let answer: string;
      try {
        answer = await askAssistant(userId, text, "team");
      } catch (err) {
        console.error("assistant failed", err);
        answer = "ขอโทษครับ ระบบ AI ขัดข้อง ลองพิมพ์ใหม่อีกครั้งนะครับ";
      }
      // ตอบช้าจน replyToken หมดอายุ → push แทน (นับโควตา)
      if (!(await say(answer))) await teamPush(userId, [textMessage(answer)]);
      return;
    }
    return await say(parsed.reply || "ไม่แน่ใจว่าต้องการให้ทำอะไร ลองพิมพ์ใหม่ เช่น \"@บอท ให้ @ต้น ทำ… ก่อน…\" ครับ");
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const replies: string[] = [];

  // ── จัดกะ (หัวหน้า/HR) ──
  if (parsed.shifts.length > 0) {
    if (!isHR(me)) {
      replies.push("⚠️ จัดกะได้เฉพาะหัวหน้าและ HR ครับ");
    } else {
      const rows = parsed.shifts.filter((s) => byId.has(s.member_id)).map((s) => ({
        member_id: s.member_id,
        work_date: s.date,
        is_off: s.off,
        start_time: s.off ? null : (s.start || null),
        end_time: s.off ? null : (s.end || null),
      }));
      const { error } = await db.from("shifts").upsert(rows, { onConflict: "member_id,work_date" });
      if (error) {
        console.error("upsert shifts failed", error);
        replies.push("บันทึกกะไม่สำเร็จ ลองใหม่อีกครั้งครับ");
      } else {
        replies.push("🗓️ ตั้งกะแล้ว\n" + rows.map((r) =>
          `${fmtDate(r.work_date)} ${memberName(byId.get(r.member_id))} — ${r.is_off ? "หยุด" : `${r.start_time ?? "11:00"}–${r.end_time ?? "22:00"}`}`
        ).join("\n"));
      }
    }
  }

  if (parsed.tasks.length === 0) return await say(replies.join("\n\n"));
  if (!isManager(me)) {
    replies.push("⚠️ สั่งงานได้เฉพาะหัวหน้าครับ");
    return await say(replies.join("\n\n"));
  }
  const rows = parsed.tasks.map((t) => ({
    title: t.title,
    detail: t.detail || null,
    assignee_id: byId.has(t.assignee_member_id) ? t.assignee_member_id : null,
    created_by: me.id,
    due_at: t.due_at && !isNaN(Date.parse(t.due_at)) ? new Date(t.due_at).toISOString() : null,
  }));
  const { data: created, error } = await db.from("tasks").insert(rows).select("id, title, due_at, assignee_id");
  if (error || !created) {
    console.error("insert tasks failed", error);
    return await say("บันทึกงานไม่สำเร็จ ลองใหม่อีกครั้งครับ");
  }

  const users: Record<string, { userId?: string | null; name: string }> = {};
  const lines = created.map((t, i) => {
    const who = t.assignee_id ? byId.get(t.assignee_id) : null;
    if (who) users[`u${i}`] = { userId: who.line_user_id, name: memberName(who) };
    return `#${t.id} ${t.title}\n👤 ${who ? `{u${i}}` : "ยังไม่มีคนรับ"}  ⏰ ${formatDue(t.due_at)}`;
  });
  const prefix = replies.length ? `${replies.join("\n\n")}\n\n` : "";
  // สั่งจากแชทส่วนตัว → แจ้งในกลุ่มด้วยให้คนรับงานเห็น (push — นับโควตา 1 ครั้งต่อการสั่ง)
  if (isPrivate) {
    await teamPush(groupId, [mentionText(`📌 งานใหม่จาก ${memberName(me)}\n\n${lines.join("\n\n")}`, users)]);
  }
  return await reply(mentionText(`${prefix}✅ สร้างงานแล้ว${isPrivate ? " (แจ้งในกลุ่มแล้ว)" : ""}\n\n${lines.join("\n\n")}`, users, isPrivate));
}

// ── ตัวช่วย ────────────────────────────────────────────────────────────────

function stripBotMention(text: string, mentionees: { index: number; length: number; isSelf?: boolean }[]) {
  // ตัดจากท้ายไปหน้า ตำแหน่งที่เหลือจะได้ไม่เลื่อน
  let out = text;
  for (const m of [...mentionees].filter((m) => m.isSelf).sort((a, b) => b.index - a.index)) {
    out = out.slice(0, m.index) + out.slice(m.index + m.length);
  }
  return out;
}

function isManager(m: Member) {
  return m.role === "owner" || m.role === "manager" || m.line_user_id === ownerId();
}

// เจ้าของ = OWNER_LINE_USER_ID หรือคนที่ถูกตั้งด้วย "ตั้งเจ้าของ"
async function isOwnerUser(lineUserId: string): Promise<boolean> {
  if (lineUserId === ownerId()) return true;
  const { data } = await db.from("team_members").select("role").eq("line_user_id", lineUserId).maybeSingle();
  return data?.role === "owner";
}

// จัดกะ/ดูรายงานได้: หัวหน้า, HR, เจ้าของ
function isHR(m: Member) {
  return m.role === "hr" || isManager(m);
}

async function ensureMember(groupId: string, lineUserId: string): Promise<Member> {
  const { data: found } = await db
    .from("team_members").select("id, line_user_id, nickname, display_name, role").eq("line_user_id", lineUserId).maybeSingle();
  if (found) return found as Member;

  const { data: created, error } = await db.from("team_members").insert({
    line_user_id: lineUserId,
    display_name: await groupMemberName(groupId, lineUserId),
    role: lineUserId === ownerId() ? "owner" : "member",
    tracks_attendance: lineUserId !== ownerId(), // เจ้าของไม่ต้องลงเวลา
  }).select("id, line_user_id, nickname, display_name, role").single();
  if (error || !created) throw error ?? new Error("สร้างสมาชิกไม่สำเร็จ");
  return created as Member;
}

async function closeTask(groupId: string, userId: string, id: number, status: "done" | "cancelled"): Promise<string> {
  const me = await ensureMember(groupId, userId);
  const { data: task } = await db
    .from("tasks").select("id, title, status, assignee_id").eq("id", id).maybeSingle();
  if (!task) return `ไม่พบงาน #${id} ครับ`;
  if (task.status !== "open") return `งาน #${id} ${task.status === "done" ? "เสร็จ" : "ถูกยกเลิก"}ไปแล้วครับ`;

  const allowed = status === "done" ? (task.assignee_id === me.id || isManager(me)) : isManager(me);
  if (!allowed) {
    return status === "done" ? `ปิดได้เฉพาะคนรับงาน #${id} หรือหัวหน้าครับ` : "เฉพาะหัวหน้ายกเลิกงานได้ครับ";
  }

  await db.from("tasks").update({ status, done_at: new Date().toISOString(), done_by: me.id }).eq("id", id);
  return status === "done"
    ? `🎉 ปิดงาน #${id} ${task.title} แล้ว (${memberName(me)})`
    : `🗑️ ยกเลิกงาน #${id} ${task.title} แล้ว`;
}

function listMessage(header: string, tasks: Awaited<ReturnType<typeof openTasks>>, plain = false) {
  if (tasks.length === 0) return textMessage(`${header}\nไม่มีงานค้าง 🎉`);
  const { lines, users } = taskLines(tasks.slice(0, 30));
  const more = tasks.length > 30 ? `\n…และอีก ${tasks.length - 30} งาน (ดูทั้งหมดในหน้าเว็บแอดมิน)` : "";
  return mentionText(`${header} ${tasks.length} รายการ\n\n${lines.join("\n")}${more}`, users, plain);
}

// ── เวลาทำงาน ─────────────────────────────────────────────────────────────

async function checkIn(me: Member, plain = false): Promise<object> {
  const today = bkkDate();
  const { data: row } = await db
    .from("attendance").select("check_in").eq("member_id", me.id).eq("work_date", today).maybeSingle();
  if (row?.check_in) return textMessage(`${memberName(me)} ลงเวลาเข้างานไปแล้วตอน ${fmtTime(row.check_in)} ครับ`);

  const shift = (await shiftsOn(today, [me])).get(me.id)!;
  const now = Date.now();
  const late = shift.off ? 0 : Math.max(0, Math.round((now - bkkTime(today, shift.start)) / 60_000));
  await db.from("attendance").upsert(
    { member_id: me.id, work_date: today, check_in: new Date(now).toISOString(), late_minutes: late },
    { onConflict: "member_id,work_date" },
  );

  const notified = (await noticesOn(today)).some((n) => n.member_id === me.id && n.kind === "late");
  const time = fmtTime(new Date(now).toISOString());
  let status = "ตรงเวลา";
  if (shift.off) status = "วันนี้เป็นวันหยุดตามกะ";
  else if (late > LATE_AFTER_MINUTES) status = `สาย ${late} นาที${notified ? " (แจ้งไว้แล้ว)" : ""}`;
  else if (late > 0) status = `ช้า ${late} นาที`;
  const icon = !shift.off && late > LATE_AFTER_MINUTES ? "⚠️" : "✅";
  return mentionText(`${icon} {u0} เข้างาน ${time} (${status})`, { u0: { userId: me.line_user_id, name: memberName(me) } }, plain);
}

async function checkOut(me: Member, plain = false): Promise<object> {
  const today = bkkDate();
  const now = new Date().toISOString();
  const { data: row } = await db
    .from("attendance").select("check_in").eq("member_id", me.id).eq("work_date", today).maybeSingle();
  await db.from("attendance").upsert(
    { member_id: me.id, work_date: today, check_out: now },
    { onConflict: "member_id,work_date" },
  );
  const hours = row?.check_in ? ` · ทำงาน ${((Date.parse(now) - Date.parse(row.check_in)) / 3_600_000).toFixed(1)} ชม.` : " (ยังไม่ได้ลงเวลาเข้างานวันนี้)";
  return mentionText(`👋 {u0} เลิกงาน ${fmtTime(now)}${hours}`, { u0: { userId: me.line_user_id, name: memberName(me) } }, plain);
}

async function addNotice(me: Member, word: string, rest: string): Promise<string> {
  const kind = word === "สาย" ? "late" : word === "ป่วย" ? "sick" : "absent";
  const tomorrow = /พรุ่งนี้/.test(rest);
  const date = bkkDate(Date.now(), tomorrow ? 1 : 0);
  const mins = rest.match(/(\d+)\s*นาที/)?.[1] ?? (rest.match(/(\d+)\s*(ชม|ชั่วโมง)/)?.[1] ? String(Number(rest.match(/(\d+)\s*(ชม|ชั่วโมง)/)![1]) * 60) : null);
  const reason = rest.replace(/พรุ่งนี้|วันนี้/g, "").replace(/\d+\s*(นาที|ชม\.?|ชั่วโมง)/g, "").trim() || null;

  await db.from("absence_notices").insert({ member_id: me.id, work_date: date, kind, minutes: mins ? Number(mins) : null, reason });
  const when = tomorrow ? "พรุ่งนี้" : "วันนี้";
  const detail = kind === "late" && mins ? ` ${mins} นาที` : "";
  return `📝 รับทราบ ${memberName(me)} ${NOTICE_LABEL[kind]}${when}${detail}${reason ? ` (${reason})` : ""}`;
}

async function shiftsReport(date: string): Promise<string> {
  const people = await staff();
  if (people.length === 0) return "ยังไม่มีพนักงานในระบบ ให้ทุกคนพิมพ์ ลงชื่อ <ชื่อเล่น> ก่อนครับ";
  const [shifts, notices] = await Promise.all([shiftsOn(date, people), noticesOn(date)]);
  const lines = people.map((p) => {
    const n = notices.filter((x) => x.member_id === p.id).map((x) => NOTICE_LABEL[x.kind]).join(", ");
    return `• ${memberName(p)} — ${shiftLabel(shifts.get(p.id)!)}${n ? ` (${n})` : ""}`;
  });
  return `🗓️ กะ${fmtDate(date)}\n${lines.join("\n")}`;
}

async function myShifts(me: Member): Promise<string> {
  const lines: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = bkkDate(Date.now(), i);
    lines.push(`${fmtDate(date)} — ${shiftLabel((await shiftsOn(date, [me])).get(me.id)!)}`);
  }
  return `🗓️ กะของ ${memberName(me)} 7 วันข้างหน้า\n${lines.join("\n")}`;
}
