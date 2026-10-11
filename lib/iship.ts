// ── iShip API client ──
// เอกสาร: https://api-docs.iship.cloud/  (Postman collection "iShip Prods Api")
//
// ความเสี่ยงหลัก: create_order หักเครดิตจริง จึงออกแบบให้
//  1) ค่าเริ่มต้นเป็น UAT (app-uat) ต้องสั่งเปลี่ยนเป็น prod เองทางหน้าตั้งค่า
//  2) ไม่ retry อัตโนมัติสำหรับ create_order — retry ตอน timeout อาจสร้างพัสดุซ้ำและหักเครดิตสองรอบ
//  3) ไม่มีฟังก์ชันไหนทำงานเองลำพัง ต้องถูกเรียกจากปุ่มที่แอดมินกดเท่านั้น
//
// ความลับ: ISHIP_PHONE / ISHIP_PASSWORD ใน env (ห้ามใส่ใน repo ที่เป็น public)
//   token ได้จาก POST /api/auth/requestToken ด้วยเบอร์โทร+รหัสผ่านบัญชี iShip มีอายุ 1 ปี
//   ขอใหม่เองเมื่อหมดอายุ ไม่ต้องให้คนมาต่ออายุ

export type IshipEnv = "uat" | "prod";

const HOSTS: Record<IshipEnv, string> = {
  uat: "https://app-uat.iship.cloud",
  prod: "https://app.iship.cloud",
};

export class IshipError extends Error {
  status: number;
  // true = รู้ว่า iShip ไม่ได้สร้างพัสดุ ลองใหม่ได้ปลอดภัย / false = ไม่แน่ใจ (เช่น timeout) ห้ามเดา
  safeToRetry: boolean;
  constructor(message: string, status = 500, safeToRetry = false) {
    super(message);
    this.status = status;
    this.safeToRetry = safeToRetry;
  }
}

export const hostFor = (env: IshipEnv) => HOSTS[env];

// cache token ต่อ instance — อายุจริง 1 ปี แต่ serverless instance สั้นกว่านั้นมาก
const tokenCache = new Map<IshipEnv, { token: string; exp: number }>();

async function getToken(env: IshipEnv): Promise<string> {
  const hit = tokenCache.get(env);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;

  const phone = process.env.ISHIP_PHONE;
  const password = process.env.ISHIP_PASSWORD;
  if (!phone || !password) {
    throw new IshipError("ยังไม่ได้ตั้งค่า ISHIP_PHONE / ISHIP_PASSWORD ใน Vercel", 503, true);
  }

  const res = await fetch(`${HOSTS[env]}/api/auth/requestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ phone, password }),
    cache: "no-store",
  });
  const json: any = await res.json().catch(() => null);
  const token = json?.data?.accessToken;
  if (!res.ok || !token) {
    throw new IshipError(
      `ขอ token จาก iShip (${env}) ไม่สำเร็จ: ${json?.message ?? res.status} — ตรวจเบอร์โทร/รหัสผ่านว่าถูกสภาพแวดล้อมหรือไม่ (บัญชี UAT กับของจริงแยกกัน)`,
      res.status === 401 || res.status === 422 ? 401 : 502,
      true
    );
  }
  const ttl = Number(json?.data?.expireIn ?? 3600) * 1000;
  tokenCache.set(env, { token, exp: Date.now() + Math.min(ttl, 6 * 3600_000) });
  return token;
}

async function call<T>(
  env: IshipEnv,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  opts: { timeoutMs?: number; mutating?: boolean } = {}
): Promise<T> {
  const token = await getToken(env);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(`${HOSTS[env]}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
      cache: "no-store",
    });
    const json: any = await res.json().catch(() => null);

    if (res.status === 401) tokenCache.delete(env);
    if (!res.ok) {
      // 4xx = iShip ปฏิเสธก่อนสร้าง ปลอดภัยที่จะแก้แล้วลองใหม่ / 5xx = ไม่แน่ใจ
      throw new IshipError(
        json?.message ?? json?.msg ?? `iShip ตอบ ${res.status}`,
        res.status,
        res.status >= 400 && res.status < 500
      );
    }
    return json as T;
  } catch (e: any) {
    if (e instanceof IshipError) throw e;
    // timeout/เครือข่ายขาดตอน create_order: ไม่รู้ว่า iShip สร้างพัสดุไปแล้วหรือยัง จึงห้ามบอกว่าลองใหม่ได้
    throw new IshipError(
      e?.name === "AbortError"
        ? "iShip ไม่ตอบภายในเวลาที่กำหนด — อาจสร้างพัสดุไปแล้ว ตรวจใน iShip ก่อนกดอีกครั้ง"
        : `เชื่อมต่อ iShip ไม่ได้: ${e?.message ?? e}`,
      504,
      !opts.mutating
    );
  } finally {
    clearTimeout(timer);
  }
}

// ── ที่อยู่/พัสดุ ──
export type IshipParty = {
  name: string; phone: string; address: string;
  district: string; amphure: string; province: string; zipcode: string;
};

export type IshipParcel = { weightKg: number; widthCm: number; lengthCm: number; heightCm: number };

export type CreateOrderInput = {
  env: IshipEnv;
  courierCode: string;
  customOrderId: string;
  src: IshipParty;
  dst: IshipParty;
  parcel: IshipParcel;
  remark?: string;
  categoryId?: number;
};

export type CreateOrderResult = { trackingNumber: string; ref: string | null; raw: unknown };

export async function createOrder(i: CreateOrderInput): Promise<CreateOrderResult> {
  const payload = {
    platform_name: "THE CARDLIST",
    courier_code: i.courierCode,
    custom_order_id: i.customOrderId, // id ออเดอร์ของเรา ไว้ตามย้อนกลับได้จากฝั่ง iShip
    src_name: i.src.name, src_phone: i.src.phone, src_address: i.src.address,
    src_district: i.src.district, src_amphure: i.src.amphure,
    src_province: i.src.province, src_zipcode: i.src.zipcode,
    dst_name: i.dst.name, dst_phone: i.dst.phone, dst_address: i.dst.address,
    dst_district: i.dst.district, dst_amphure: i.dst.amphure,
    dst_province: i.dst.province, dst_zipcode: i.dst.zipcode,
    weight: i.parcel.weightKg, width: i.parcel.widthCm,
    length: i.parcel.lengthCm, height: i.parcel.heightCm,
    // ลูกค้าจ่ายเงินผ่าน Stripe แล้ว จึงไม่เก็บเงินปลายทางเด็ดขาด — ใส่ 0 ชัดเจนกันถูกตีความเป็น COD
    cod_amount: 0,
    category_id: i.categoryId ?? 3,
    remark: i.remark ?? "",
  };

  const json: any = await call(i.env, "POST", "/api/create_order", payload, { mutating: true, timeoutMs: 30_000 });

  // สำเร็จต้องมี status:true และ tracking_number — ถ้า iShip ตอบ 200 แต่ไม่สำเร็จ ต้องไม่ถือว่าสร้างแล้ว
  const ok = json?.status === true || json?.status === 1 || json?.code === "0000";
  const tracking = json?.data?.tracking_number;
  if (!ok || !tracking) {
    throw new IshipError(json?.message ?? json?.msg ?? "iShip ไม่ได้คืนเลขพัสดุ", 422, true);
  }
  return { trackingNumber: String(tracking), ref: json?.data?.ref ? String(json.data.ref) : null, raw: json };
}

export type CheckPriceInput = {
  env: IshipEnv; courierCode: string;
  src: Pick<IshipParty, "district" | "amphure" | "province" | "zipcode">;
  dst: Pick<IshipParty, "district" | "amphure" | "province" | "zipcode">;
  parcel: IshipParcel;
};

export async function checkPrice(i: CheckPriceInput): Promise<{ price: number; totalPrice: number; remoteArea: number }> {
  const json: any = await call(i.env, "POST", "/api/v2/check-price", {
    courier_code: i.courierCode,
    src_zipcode: i.src.zipcode, src_province: i.src.province, src_amphure: i.src.amphure, src_district: i.src.district,
    dst_zipcode: i.dst.zipcode, dst_province: i.dst.province, dst_amphure: i.dst.amphure, dst_district: i.dst.district,
    weight: String(i.parcel.weightKg), width: String(i.parcel.widthCm),
    length: String(i.parcel.lengthCm), height: String(i.parcel.heightCm),
  });
  const total = Number(json?.total_price);
  if (!Number.isFinite(total)) throw new IshipError(json?.message ?? "iShip ไม่ได้คืนราคา", 422, true);
  return { price: Number(json?.price ?? total), totalPrice: total, remoteArea: Number(json?.remote_area ?? 0) };
}

// ยกเลิกพัสดุ — ยังไม่เปิดใช้: เอกสาร iShip แสดงเฉพาะ response ของ cancel_order แต่ไม่ระบุ body ที่ต้องส่ง
// ถ้าเดาชื่อฟิลด์ผิด ในกรณีดีคือ error ในกรณีร้ายคือยกเลิกพัสดุผิดชิ้น จึงไม่เดา
// ต้องยืนยันฟิลด์กับทีม iShip หรือเห็นตัวอย่าง request จริงก่อนค่อยเปิด
export async function cancelOrder(_env: IshipEnv, _trackingNumber: string): Promise<never> {
  throw new IshipError("การยกเลิกผ่าน API ยังไม่เปิดใช้ — ให้ยกเลิกที่ app.iship.cloud โดยตรง", 501, true);
}

export async function listCouriers(env: IshipEnv): Promise<{ code: string; name: string }[]> {
  const json: any = await call(env, "GET", "/api/courier_code");
  return Array.isArray(json?.data) ? json.data : [];
}

// URL ใบปะหน้า A6 (PDF) — ต้องแนบ Bearer ตอนเปิด จึงดึงผ่านเซิร์ฟเวอร์เรา ไม่ให้ token หลุดไปฝั่งเบราว์เซอร์
export async function fetchLabelPdf(env: IshipEnv, trackingNumber: string): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string }> {
  const token = await getToken(env);
  const res = await fetch(`${HOSTS[env]}/api/download/pdf?tracks=${encodeURIComponent(trackingNumber)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `ดึงใบปะหน้าไม่สำเร็จ (${res.status})` };
  return { ok: true, bytes: await res.arrayBuffer() };
}
