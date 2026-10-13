import { redirect } from "next/navigation";

// หน้าเดิมรวมอีเวนต์ + จองโต๊ะ Vendor แบบเก่า (ไม่ผ่านการชำระเงิน) — ย้ายไปใช้ /events และ /booth แล้ว
export default function TournamentPage() {
  redirect("/events");
}
