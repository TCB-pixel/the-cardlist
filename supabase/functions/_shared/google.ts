// เขียน Google Sheets ด้วย Service Account (ไม่ใช้ library — เซ็น JWT ด้วย Web Crypto)
// ต้องตั้ง secret: GOOGLE_SERVICE_ACCOUNT_JSON (ไฟล์กุญแจ JSON ทั้งไฟล์) และแชร์ Sheet ให้อีเมลของ service account เป็น Editor

type ServiceAccount = { client_email: string; private_key: string };

function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  return JSON.parse(raw) as ServiceAccount;
}

export function sheetsConfigured(): boolean {
  return !!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") && !!Deno.env.get("TEAM_REPORT_SHEET_ID");
}

export function sheetUrl(): string | null {
  const id = Deno.env.get("TEAM_REPORT_SHEET_ID");
  return id ? `https://docs.google.com/spreadsheets/d/${id}` : null;
}

const b64url = (data: Uint8Array | string) =>
  btoa(typeof data === "string" ? data : String.fromCharCode(...data))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));

  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`)));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

// เพิ่มแถวต่อท้ายแท็บ (สร้างแท็บ + หัวตารางให้ถ้ายังไม่มี)
export async function appendRows(tab: string, header: string[], rows: (string | number)[][]): Promise<void> {
  const sa = serviceAccount();
  const sheetId = Deno.env.get("TEAM_REPORT_SHEET_ID");
  if (!sa || !sheetId) throw new Error("ยังไม่ได้ตั้งค่า Google Sheets");

  const token = await accessToken(sa);
  const api = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const meta = await fetch(`${api}?fields=sheets.properties.title`, { headers: auth });
  if (!meta.ok) throw new Error(`อ่าน Sheet ไม่ได้ (${meta.status}) — แชร์ Sheet ให้ ${sa.client_email} หรือยัง?`);
  const titles: string[] = (await meta.json()).sheets.map((s: { properties: { title: string } }) => s.properties.title);

  if (!titles.includes(tab)) {
    await fetch(`${api}:batchUpdate`, {
      method: "POST", headers: auth,
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1 } } } }] }),
    });
    rows = [header, ...rows];
  }

  const range = encodeURIComponent(`'${tab}'!A1`);
  const res = await fetch(`${api}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST", headers: auth, body: JSON.stringify({ values: rows }),
  });
  if (!res.ok) throw new Error(`เขียน Sheet ไม่ได้: ${res.status} ${await res.text()}`);
}
