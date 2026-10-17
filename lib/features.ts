// เปิด/ปิดเมนูของฟีเจอร์ที่ยังพัฒนาอยู่ — ปิด = ซ่อนจากเมนูลูกค้า แต่หน้ายังเปิดได้ด้วยลิงก์ตรง (ไว้ทดสอบ)
// เจ้าของสั่ง 17 ต.ค. 2026: "พัฒนา Function สองอย่างนี้เพิ่ม แต่ตอนนี้ซ่อนจากหน้าหลักก่อน"
// เจ้าของสั่ง 17 ต.ค. 2026: "เปิด Deck Builder ให้ลูกค้าเห็น" (Collection Tracker ยังซ่อน)
export const FEATURES = {
  collectionTracker: false, // /profile/collection
  deckBuilder: true,        // /profile/decks
};
