// ─────────────────────────────────────────────────────────────────────────
// ระบบ Tier สมาชิก — คำนวณสดจากยอดซื้อสะสมจริง (ไม่พึ่งค่า profiles.tier
// ที่เป็น static column และไม่เคยอัปเดตอัตโนมัติ) ใช้ร่วมกันทั้งฝั่งลูกค้า
// (/profile) และฝั่งแอดมิน (/admin/members)
// ตอนนี้เป็นแค่ badge ตกแต่ง ยังไม่มีสิทธิพิเศษจริงผูกกับ tier
// ─────────────────────────────────────────────────────────────────────────

export type TierKey = "bronze" | "silver" | "gold" | "platinum";

export const TIER_ORDER: TierKey[] = ["bronze", "silver", "gold", "platinum"];

// ยอดซื้อสะสมขั้นต่ำ (บาท) ที่ต้องถึงเพื่อขึ้น tier นั้นๆ
export const TIER_THRESHOLDS: Record<TierKey, number> = {
  bronze: 0,
  silver: 10000,
  gold: 30000,
  platinum: 100000,
};

export const TIER_LABEL: Record<TierKey, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export const TIER_COLOR: Record<TierKey, string> = {
  bronze: "#CD7F32",
  silver: "#A8A9AD",
  gold: "#EF9F27",
  platinum: "#7F77DD",
};

// หา tier ปัจจุบันจากยอดซื้อสะสม (บาท)
export function getTier(totalSpend: number): TierKey {
  let current: TierKey = "bronze";
  for (const t of TIER_ORDER) {
    if (totalSpend >= TIER_THRESHOLDS[t]) current = t;
  }
  return current;
}

// หา tier ถัดไป + ยอดที่ต้องใช้ถึงจะขึ้น (null ถ้าอยู่ tier สูงสุดแล้ว)
export function getNextTier(tier: TierKey): { next: TierKey | null; nextThreshold: number | null } {
  const idx = TIER_ORDER.indexOf(tier);
  const next = TIER_ORDER[idx + 1] ?? null;
  return { next, nextThreshold: next ? TIER_THRESHOLDS[next] : null };
}
