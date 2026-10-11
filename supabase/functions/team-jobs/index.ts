// งานตั้งเวลาของบอททีม (pg_cron เรียก)
//   {"job":"remind"}  ทุก 15 นาที — เตือนงานที่จะครบกำหนดภายใน 1 ชม. + เตือนคนที่ยังไม่ลงเวลาเข้างาน
//   {"job":"morning"} 9:00 น. — สรุปกะวันนี้ + งานเลยกำหนด / ครบกำหนดวันนี้ / ค้างทั้งหมด
//   {"job":"report"}  22:30 น. — รายงานรายวันลง Google Sheets + LINE ส่วนตัวถึงเจ้าของ (OWNER_LINE_USER_ID)
//   {"job":"weekly"}  จันทร์ 9:00 น. — Performance รายคนของสัปดาห์ก่อน (จ.–อา.) ลง Google Sheets + LINE ถึงเจ้าของ
// ทุกแบบเป็น push → นับโควตา OA ทีม จึงไม่ส่งถ้าไม่มีอะไรต้องแจ้ง
import { db, ownerId } from "../_shared/db.ts";
import { memberName, mentionText, openTasks, taskLines, teamGroupId, teamPush } from "../_shared/team.ts";
import {
  attendanceEnabled, bkkDate, bkkTime, fmtDate, fmtTime, LATE_AFTER_MINUTES, NOTICE_LABEL, noticesOn, shiftLabel, shiftsOn, staff,
} from "../_shared/hr.ts";
import { appendRows, sheetsConfigured, sheetUrl } from "../_shared/google.ts";
import { textMessage } from "../_shared/line.ts";

Deno.serve(async (req) => {
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: valid } = await db.rpc("chatbot_verify_cron_secret", { p_secret: secret });
  if (!valid) return new Response("Unauthorized", { status: 401 });

  const groupId = teamGroupId();
  if (!groupId) return new Response("TEAM_GROUP_ID not set — skipped"); // ยังไม่ได้ตั้งค่า ไม่ถือว่าผิดพลาด

  const { job } = await req.json().catch(() => ({ job: "" }));
  if (job === "remind") return await remind(groupId);
  if (job === "morning") return await morning(groupId);
  if (job === "report") return await report();
  if (job === "weekly") return await weekly();
  return new Response("unknown job", { status: 400 });
});

type Users = Record<string, { userId?: string | null; name: string }>;

async function remind(groupId: string) {
  const parts: string[] = [];
  const users: Users = {};
  const markTasks: number[] = [];
  const markMissing: string[] = [];

  // 1) งานใกล้ครบกำหนดภายใน 1 ชม. ที่ยังไม่เคยเตือน
  const now = Date.now();
  const soon = (await openTasks()).filter((t) => t.due_at && Date.parse(t.due_at) > now && Date.parse(t.due_at) <= now + 3600_000);
  if (soon.length) {
    const { data: fresh } = await db.from("tasks").select("id").in("id", soon.map((t) => t.id)).is("reminded_at", null);
    const ids = new Set((fresh ?? []).map((r) => r.id));
    const due = soon.filter((t) => ids.has(t.id));
    if (due.length) {
      const { lines, users: u } = taskLines(due, "t");
      Object.assign(users, u);
      parts.push(`⏰ ใกล้ครบกำหนดใน 1 ชั่วโมง\n${lines.join("\n")}`);
      markTasks.push(...due.map((t) => t.id));
    }
  }

  // 2) เลยเวลาเข้ากะเกินเกณฑ์สายแล้ว ยังไม่ลงเวลา และไม่ได้แจ้งขาด/สาย/ป่วย (เตือนครั้งเดียวต่อวัน)
  const today = bkkDate();
  const people = attendanceEnabled() ? await staff() : [];
  if (people.length) {
    const [shifts, notices, { data: att }] = await Promise.all([
      shiftsOn(today, people),
      noticesOn(today),
      db.from("attendance").select("member_id, check_in, missing_alerted_at").eq("work_date", today),
    ]);
    const attBy = new Map((att ?? []).map((a) => [a.member_id, a]));
    const missing = people.filter((p) => {
      const s = shifts.get(p.id)!;
      if (s.off) return false;
      const start = bkkTime(today, s.start);
      const a = attBy.get(p.id);
      return now > start + LATE_AFTER_MINUTES * 60_000 && now < bkkTime(today, s.end) &&
        !a?.check_in && !a?.missing_alerted_at && !notices.some((n) => n.member_id === p.id);
    });
    if (missing.length) {
      const names = missing.map((p, i) => {
        users[`m${i}`] = { userId: p.line_user_id, name: memberName(p) };
        return `{m${i}}`;
      });
      parts.push(`🕐 ยังไม่เห็นลงเวลาเข้างาน: ${names.join(" ")}\nพิมพ์ เข้างาน หรือ แจ้งสาย/แจ้งป่วย ได้เลยครับ`);
      markMissing.push(...missing.map((p) => p.id));
    }
  }

  if (parts.length === 0) return new Response("nothing to remind");
  const ok = await teamPush(groupId, [mentionText(parts.join("\n\n"), users)]);
  if (ok) {
    const stamp = new Date().toISOString();
    if (markTasks.length) await db.from("tasks").update({ reminded_at: stamp }).in("id", markTasks);
    if (markMissing.length) {
      await db.from("attendance").upsert(
        markMissing.map((id) => ({ member_id: id, work_date: today, missing_alerted_at: stamp })),
        { onConflict: "member_id,work_date" },
      );
    }
  }
  return new Response(ok ? "reminded" : "push failed", { status: ok ? 200 : 502 });
}

async function morning(groupId: string) {
  const today = bkkDate();
  const [tasks, people] = await Promise.all([openTasks(), staff()]);
  const parts: string[] = [`☀️ สรุปเช้า ${fmtDate(today)}`];
  const users: Users = {};

  if (people.length) {
    const [shifts, notices] = await Promise.all([shiftsOn(today, people), noticesOn(today)]);
    parts.push("🗓️ กะวันนี้\n" + people.map((p) => {
      const n = notices.filter((x) => x.member_id === p.id).map((x) => NOTICE_LABEL[x.kind]).join(", ");
      return `• ${memberName(p)} — ${shiftLabel(shifts.get(p.id)!)}${n ? ` (${n})` : ""}`;
    }).join("\n"));
  }

  if (tasks.length) {
    const now = Date.now();
    const overdue = tasks.filter((t) => t.due_at && Date.parse(t.due_at) < now);
    const dueToday = tasks.filter((t) => t.due_at && Date.parse(t.due_at) >= now && bkkDate(Date.parse(t.due_at)) === today);
    const rest = tasks.filter((t) => !overdue.includes(t) && !dueToday.includes(t));
    const section = (title: string, list: typeof tasks, prefix: string) => {
      if (list.length === 0) return;
      const { lines, users: u } = taskLines(list.slice(0, 15), prefix);
      Object.assign(users, u);
      parts.push(`${title} (${list.length})\n${lines.join("\n")}${list.length > 15 ? "\n…" : ""}`);
    };
    section("🔴 เลยกำหนด", overdue, "a");
    section("🟡 ครบกำหนดวันนี้", dueToday, "b");
    section("⚪ งานค้างอื่นๆ", rest, "c");
  }

  if (parts.length === 1) return new Response("nothing to send"); // ไม่มีพนักงาน/งาน ไม่ต้องเปลืองโควตา
  const ok = await teamPush(groupId, [mentionText(parts.join("\n\n"), users)]);
  return new Response(ok ? "sent" : "push failed", { status: ok ? 200 : 502 });
}

// ── รายงานรายวัน 22:30 ──────────────────────────────────────────────────────

const REPORT_HEADER = [
  "วันที่", "ชื่อ", "กะ", "เข้างาน", "เลิกงาน", "ชั่วโมงทำงาน", "สาย (นาที)", "แจ้งขาด/สาย/ป่วย",
  "งานที่ได้รับวันนี้", "งานที่ปิดวันนี้", "งานค้าง", "งานเลยกำหนด",
];

async function report() {
  const today = bkkDate();
  const dayStart = new Date(bkkTime(today, "00:00")).toISOString();
  const now = Date.now();

  const { data: membersData } = await db
    .from("team_members").select("id, line_user_id, nickname, display_name, role, tracks_attendance").eq("active", true);
  const members = membersData ?? [];
  const people = members.filter((m) => m.tracks_attendance);

  const [shifts, notices, { data: att }, { data: newTasks }, { data: doneTasks }, open] = await Promise.all([
    shiftsOn(today, people),
    noticesOn(today),
    db.from("attendance").select("member_id, check_in, check_out, late_minutes").eq("work_date", today),
    db.from("tasks").select("id, title, assignee_id").gte("created_at", dayStart),
    db.from("tasks").select("id, title, assignee_id").eq("status", "done").gte("done_at", dayStart),
    db.from("tasks").select("id, assignee_id, due_at").eq("status", "open"),
  ]);
  const attBy = new Map((att ?? []).map((a) => [a.member_id, a]));
  const list = (rows: { id: number; title: string; assignee_id: string | null }[] | null, id: string) =>
    (rows ?? []).filter((t) => t.assignee_id === id).map((t) => `#${t.id} ${t.title}`);

  // คนที่ต้องลงเวลา + คนที่มีงานวันนี้ (เช่น หัวหน้าที่รับงานเอง)
  const ids = new Set([
    ...people.map((p) => p.id),
    ...[...(newTasks ?? []), ...(doneTasks ?? []), ...(open.data ?? [])].map((t) => t.assignee_id).filter(Boolean) as string[],
  ]);
  const rows = members.filter((m) => ids.has(m.id)).map((m) => {
    const a = attBy.get(m.id);
    const s = shifts.get(m.id);
    const hours = a?.check_in && a?.check_out ? ((Date.parse(a.check_out) - Date.parse(a.check_in)) / 3_600_000).toFixed(1) : "";
    const late = a?.check_in && (a.late_minutes ?? 0) > LATE_AFTER_MINUTES ? a.late_minutes : "";
    const myOpen = (open.data ?? []).filter((t) => t.assignee_id === m.id);
    return {
      member: m,
      late,
      opened: myOpen.length,
      done: list(doneTasks, m.id),
      cells: [
        today, memberName(m), s ? shiftLabel(s) : "-",
        a?.check_in ? fmtTime(a.check_in) : (attendanceEnabled() && m.tracks_attendance && s && !s.off ? "ไม่ได้ลงเวลา" : ""),
        a?.check_out ? fmtTime(a.check_out) : "",
        hours, late,
        notices.filter((n) => n.member_id === m.id).map((n) => `${NOTICE_LABEL[n.kind]}${n.minutes ? ` ${n.minutes} นาที` : ""}${n.reason ? ` (${n.reason})` : ""}`).join(", "),
        list(newTasks, m.id).join(", "),
        list(doneTasks, m.id).join(", "),
        myOpen.length,
        myOpen.filter((t) => t.due_at && Date.parse(t.due_at) < now).length,
      ] as (string | number)[],
    };
  });
  if (rows.length === 0) return new Response("nothing to report");

  // 1) Google Sheets
  let sheetNote = "";
  if (sheetsConfigured()) {
    try {
      await appendRows("รายวัน", REPORT_HEADER, rows.map((r) => r.cells));
    } catch (err) {
      console.error("sheets failed", err);
      sheetNote = "\n⚠️ บันทึกลง Google Sheet ไม่สำเร็จ";
    }
  }

  // 2) LINE ส่วนตัวถึงเจ้าของ (OWNER_LINE_USER_ID) คนเดียว — ประหยัดโควตา (ต้องแอดบอทเป็นเพื่อนก่อน)
  const summary = rows.map((r) => {
    const c = r.cells;
    const time = c[3] ? `${c[3]}${c[4] ? `–${c[4]}` : ""}` : "";
    const bits = [time, r.late ? `สาย ${r.late} นาที` : "", c[7] ? String(c[7]) : "", `ปิดงาน ${r.done.length}`, `ค้าง ${r.opened}`].filter(Boolean);
    return `• ${c[1]} — ${bits.join(" · ")}`;
  });
  const link = sheetUrl() && sheetsConfigured() ? `\n\nดูรายละเอียด: ${sheetUrl()}` : "";
  const text = `📊 สรุปทีม ${fmtDate(today)}\n\n${summary.join("\n")}${link}${sheetNote}`;

  const owner = ownerId();
  const sent = owner ? await teamPush(owner, [textMessage(text)]) : false;
  return new Response(`report rows=${rows.length} sent=${sent}`);
}

// ── Performance รายสัปดาห์ (จันทร์ 9:00) ──────────────────────────────────────

const WEEKLY_HEADER = [
  "สัปดาห์", "ชื่อ", "งานที่ได้รับ", "ปิดแล้ว", "ปิดตรงเวลา", "ปิดช้า", "% ตรงเวลา",
  "ยังค้าง", "ค้างเลยกำหนด", "เวลาเฉลี่ยต่องาน (ชม.)", "แจ้งสาย", "แจ้งป่วย", "แจ้งขาด", "มาสาย (ครั้ง)",
];

async function weekly() {
  // สัปดาห์ก่อน: จันทร์ 00:00 – จันทร์นี้ 00:00 (เวลาไทย)
  const today = bkkDate();
  const dow = (new Date(`${today}T12:00:00+07:00`).getUTCDay() + 6) % 7; // จันทร์ = 0
  const thisMonday = bkkDate(Date.now(), -dow);
  const lastMonday = bkkDate(Date.now(), -dow - 7);
  const lastSunday = bkkDate(Date.now(), -dow - 1);
  const from = new Date(bkkTime(lastMonday, "00:00")).toISOString();
  const to = new Date(bkkTime(thisMonday, "00:00")).toISOString();
  const label = `${fmtDate(lastMonday)} – ${fmtDate(lastSunday)}`;
  const now = Date.now();

  const [{ data: membersData }, { data: assigned }, { data: done }, { data: open }, { data: notices }, { data: att }] =
    await Promise.all([
      db.from("team_members").select("id, nickname, display_name, role, tracks_attendance").eq("active", true),
      db.from("tasks").select("assignee_id").gte("created_at", from).lt("created_at", to),
      db.from("tasks").select("assignee_id, created_at, done_at, due_at").eq("status", "done").gte("done_at", from).lt("done_at", to),
      db.from("tasks").select("assignee_id, due_at").eq("status", "open"),
      db.from("absence_notices").select("member_id, kind").gte("work_date", lastMonday).lte("work_date", lastSunday),
      db.from("attendance").select("member_id, late_minutes, check_in").gte("work_date", lastMonday).lte("work_date", lastSunday),
    ]);

  const by = <T extends Record<string, unknown>>(rows: T[] | null, key: keyof T, id: string) =>
    (rows ?? []).filter((r) => r[key] === id);

  // พนักงานที่ต้องลงเวลา + ใครก็ตามที่มีงานในสัปดาห์ (ไม่รวมเจ้าของที่ไม่มีงาน)
  const members = (membersData ?? []).filter((m) =>
    m.tracks_attendance || [...(assigned ?? []), ...(done ?? []), ...(open ?? [])].some((t) => t.assignee_id === m.id)
  );
  if (members.length === 0) return new Response("nothing to report");

  const rows = members.map((m) => {
    const got = by(assigned, "assignee_id", m.id).length;
    const closed = by(done, "assignee_id", m.id);
    const onTime = closed.filter((t) => !t.due_at || Date.parse(t.done_at!) <= Date.parse(t.due_at)).length;
    const pending = by(open, "assignee_id", m.id);
    const overdue = pending.filter((t) => t.due_at && Date.parse(t.due_at) < now).length;
    const avgHours = closed.length
      ? (closed.reduce((s, t) => s + (Date.parse(t.done_at!) - Date.parse(t.created_at)), 0) / closed.length / 3_600_000).toFixed(1)
      : "";
    const n = by(notices, "member_id", m.id);
    const lateDays = attendanceEnabled()
      ? by(att, "member_id", m.id).filter((a) => a.check_in && (a.late_minutes ?? 0) > LATE_AFTER_MINUTES).length
      : "";
    return {
      name: memberName(m), closed: closed.length, onTime, pending: pending.length, overdue,
      cells: [
        label, memberName(m), got, closed.length, onTime, closed.length - onTime,
        closed.length ? `${Math.round((onTime / closed.length) * 100)}%` : "",
        pending.length, overdue, avgHours,
        n.filter((x) => x.kind === "late").length, n.filter((x) => x.kind === "sick").length,
        n.filter((x) => x.kind === "absent").length, lateDays,
      ] as (string | number)[],
    };
  });

  let sheetNote = "";
  if (sheetsConfigured()) {
    try {
      await appendRows("รายสัปดาห์", WEEKLY_HEADER, rows.map((r) => r.cells));
    } catch (err) {
      console.error("weekly sheets failed", err);
      sheetNote = "\n⚠️ บันทึกลง Google Sheet ไม่สำเร็จ";
    }
  }

  const lines = rows.map((r) =>
    `• ${r.name} — ปิด ${r.closed} งาน (ตรงเวลา ${r.onTime}) · ค้าง ${r.pending}${r.overdue ? ` · เลยกำหนด ${r.overdue}` : ""}`
  );
  const link = sheetsConfigured() && sheetUrl() ? `\n\nดูรายละเอียด: ${sheetUrl()}` : "";
  const owner = ownerId();
  const sent = owner
    ? await teamPush(owner, [textMessage(`📈 Performance ทีม ${label}\n\n${lines.join("\n")}${link}${sheetNote}`)])
    : false;
  return new Response(`weekly rows=${rows.length} sent=${sent}`);
}
