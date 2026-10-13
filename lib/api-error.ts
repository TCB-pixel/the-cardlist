// ข้อความผิดพลาดที่ส่งกลับให้ผู้ใช้: ภาษาไทยที่เข้าใจได้ ส่วนรายละเอียดทางเทคนิคเก็บไว้ใน log ของเซิร์ฟเวอร์
export function publicError(err: unknown, message = "ทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"): string {
  console.error(err);
  return message;
}
