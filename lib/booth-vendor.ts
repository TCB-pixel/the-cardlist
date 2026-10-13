// ข้อมูลร้านของ Vendor — ตรวจรูปแบบที่เซิร์ฟเวอร์ ใช้ร่วมกันทั้งหน้าลงทะเบียนและตอนจอง

export const PRODUCT_TYPES = [
  "การ์ดแยกใบ (Singles)",
  "กล่อง/ซอง (Sealed)",
  "อุปกรณ์เสริม (สลีฟ แฟ้ม เพลย์แมท)",
  "ของสะสม/ฟิกเกอร์",
  "อาหารและเครื่องดื่ม",
  "อื่นๆ",
] as const;

export type VendorInfo = {
  shop_name: string;
  contact_name: string;
  phone: string;
  line_id: string | null;
  social_url: string | null;
  product_types: string[];
  product_detail: string | null;
  logo_url: string | null;
};

// โลโก้ต้องเป็นไฟล์ที่ผู้ใช้คนนี้อัปโหลดผ่านระบบเราเอง (กันใส่ลิงก์ภายนอก/ของคนอื่น)
function logoPrefix(userId: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/vendor-logos/${userId}/`;
}

export function validateVendor(
  input: any,
  userId: string
): { ok: true; value: VendorInfo } | { ok: false; error: string } {
  const shop = String(input?.shop_name ?? "").trim();
  const contact = String(input?.contact_name ?? "").trim();
  const phone = String(input?.phone ?? "").replace(/\D/g, "");
  if (shop.length < 2 || shop.length > 80) return { ok: false, error: "กรอกชื่อร้าน/แบรนด์ (2–80 ตัวอักษร)" };
  if (contact.length < 2 || contact.length > 80) return { ok: false, error: "กรอกชื่อผู้ติดต่อ" };
  if (!/^0\d{8,9}$/.test(phone)) return { ok: false, error: "เบอร์โทรไม่ถูกต้อง" };

  const types = Array.from(new Set(Array.isArray(input?.product_types) ? input.product_types.map(String) : []))
    .filter((t) => (PRODUCT_TYPES as readonly string[]).includes(t as string)) as string[];
  if (types.length === 0) return { ok: false, error: "เลือกประเภทสินค้าที่จะจำหน่ายอย่างน้อย 1 ข้อ" };

  const detail = String(input?.product_detail ?? "").trim().slice(0, 300);
  if (types.includes("อื่นๆ") && !detail) return { ok: false, error: "ระบุรายละเอียดสินค้าในช่อง \"อื่นๆ\"" };

  const line = String(input?.line_id ?? "").trim().slice(0, 60);
  let social = String(input?.social_url ?? "").trim().slice(0, 300);
  if (social && !/^https?:\/\//i.test(social)) social = `https://${social}`;
  if (social) {
    try {
      const u = new URL(social);
      if (!/^https?:$/.test(u.protocol)) throw new Error("bad");
    } catch {
      return { ok: false, error: "ลิงก์เพจ/โซเชียลไม่ถูกต้อง" };
    }
  }

  const logo = String(input?.logo_url ?? "").trim();
  if (logo && (!logo.startsWith(logoPrefix(userId)) || logo.length > 400)) {
    return { ok: false, error: "โลโก้ไม่ถูกต้อง กรุณาอัปโหลดใหม่" };
  }

  return {
    ok: true,
    value: {
      logo_url: logo || null,
      shop_name: shop, contact_name: contact, phone,
      line_id: line || null, social_url: social || null,
      product_types: types, product_detail: detail || null,
    },
  };
}
