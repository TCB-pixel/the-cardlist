// ของใช้ร่วมของบอทสั่งงานทีม (team-bot + team-jobs)
// ใช้ LINE OA "CARDLIST MANAGER" คนละตัวกับบอทลูกค้า → token/secret แยก (TEAM_*)
import { callWith, clip } from "./line.ts";
import { db } from "./db.ts";

const LINE_API = "https://api.line.me/v2/bot";

function teamToken(): string {
  const t = Deno.env.get("TEAM_LINE_CHANNEL_ACCESS_TOKEN");
  if (!t) throw new Error("ยังไม่ได้ตั้งค่า TEAM_LINE_CHANNEL_ACCESS_TOKEN");
  return t;
}

export function teamGroupId(): string | null {
  return Deno.env.get("TEAM_GROUP_ID") ?? null;
}

export async function teamReply(replyToken: string, messages: object[]): Promise<boolean> {
  const res = await callWith(teamToken(), "/message/reply", { replyToken, messages });
  if (!res.ok) console.error("team reply failed", res.status, await res.text());
  return res.ok;
}

// push นับโควตาของ OA ทีม — ใช้เฉพาะเตือนงานและสรุปตอนเช้า
export async function teamPush(to: string, messages: object[]): Promise<boolean> {
  const res = await callWith(teamToken(), "/message/push", { to, messages });
  if (!res.ok) console.error("team push failed", res.status, await res.text());
  return res.ok;
}

// จุด "กำลังพิมพ์..." ในแชทส่วนตัวกับบอททีม (ฟรี ไม่นับโควตา — ใช้ในกลุ่มไม่ได้)
export async function teamShowLoading(chatId: string, seconds = 20): Promise<void> {
  await callWith(teamToken(), "/chat/loading/start", { chatId, loadingSeconds: seconds }).catch(() => {});
}

// ชื่อที่แสดงในกลุ่ม (ใช้ได้แม้คนนั้นไม่ได้แอดบอทเป็นเพื่อน)
export async function groupMemberName(groupId: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${LINE_API}/group/${groupId}/member/${userId}`, {
      headers: { Authorization: `Bearer ${teamToken()}` },
    });
    if (!res.ok) return null;
    return (await res.json()).displayName ?? null;
  } catch {
    return null;
  }
}

export type Member = {
  id: string;
  line_user_id: string;
  nickname: string | null;
  display_name: string | null;
  role: "owner" | "manager" | "hr" | "member";
};

export function memberName(m: Pick<Member, "nickname" | "display_name"> | null | undefined): string {
  return m?.nickname || m?.display_name || "ไม่ระบุชื่อ";
}

// ข้อความที่แท็กคนได้จริง (textV2): ใน text ใส่ {u0} {u1} … แล้วบอกว่าแต่ละตัวคือใคร
// คนที่ไม่มี LINE user ID (หรือ plain = true เช่น ตอบในแชทส่วนตัว) จะแสดงเป็นชื่อธรรมดาแทน
export function mentionText(text: string, users: Record<string, { userId?: string | null; name: string }>, plain = false) {
  const substitution: Record<string, object> = {};
  let out = text;
  for (const [key, u] of Object.entries(users)) {
    if (u.userId && !plain) substitution[key] = { type: "mention", mentionee: { type: "user", userId: u.userId } };
    else out = out.replaceAll(`{${key}}`, u.name);
  }
  if (Object.keys(substitution).length === 0) return { type: "text", text: clip(out) };
  return { type: "textV2", text: clip(out), substitution };
}

export function formatDue(due: string | null): string {
  if (!due) return "ไม่กำหนดเวลา";
  return new Date(due).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export type TaskRow = {
  id: number;
  title: string;
  due_at: string | null;
  assignee: Pick<Member, "line_user_id" | "nickname" | "display_name"> | null;
};

export async function openTasks(): Promise<TaskRow[]> {
  const { data } = await db
    .from("tasks")
    .select("id, title, due_at, assignee:team_members!tasks_assignee_id_fkey(line_user_id, nickname, display_name)")
    .eq("status", "open")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("id");
  return (data ?? []) as unknown as TaskRow[];
}

// บรรทัดละงาน พร้อมแท็กคนรับผิดชอบ — คืน { lines, users } ไว้ประกอบ mentionText
export function taskLines(tasks: TaskRow[], keyPrefix = "u") {
  const users: Record<string, { userId?: string | null; name: string }> = {};
  const lines = tasks.map((t, i) => {
    const key = `${keyPrefix}${i}`;
    users[key] = { userId: t.assignee?.line_user_id, name: memberName(t.assignee) };
    return `#${t.id} ${t.title} — ${t.assignee ? `{${key}}` : "ยังไม่มีคนรับ"} (${formatDue(t.due_at)})`;
  });
  return { lines, users };
}
