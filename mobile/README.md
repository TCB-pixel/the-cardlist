# แอปมือถือ The Cardlist (Capacitor)

แอปเปิด https://thecardlistbkk.com ในตัว + ของเนทีฟ · แผนเต็ม: `AI SMART/company-brain/output/web/2026-10-17_mobile-app-plan.md`

- `capacitor.config.ts` — appId `com.thecardlist.app`, โดเมนที่เปิดในแอปได้, หน้า offline (`www/error.html`)
- `android/`, `ios/` — โปรเจกต์เนทีฟ (สร้างด้วย `npx cap add`)
- ฝั่งเว็บ: `lib/native.ts` ตรวจว่าเปิดในแอปไหม · `components/passport/Scanner.tsx` ใช้กล้องเนทีฟเมื่ออยู่ในแอป

## สร้างแอป
```
cd mobile
npm install
npx cap sync
```
- Android: ต้องมี Android Studio (หรือ JDK 21 + Android SDK) → `npx cap open android` หรือ `cd android && gradlew assembleDebug`
- iOS: ต้อง build บน macOS (Xcode) หรือบริการ build บนคลาวด์ — เครื่องนี้เป็น Windows

แก้เว็บแล้ว deploy ขึ้น Vercel = แอปเปลี่ยนตามทันที · ต้องปล่อยแอปเวอร์ชันใหม่เฉพาะตอนแก้ไฟล์ในโฟลเดอร์นี้หรือเพิ่มปลั๊กอิน
