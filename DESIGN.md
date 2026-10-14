# DESIGN.md — The Cardlist (thecardlistbkk.com)

ไฟล์นี้บอกว่าเว็บ The Cardlist ต้องหน้าตาและให้ความรู้สึกแบบไหน ใช้คู่กับโค้ด: ทุกครั้งที่สร้างหรือแก้หน้า
(คนหรือ AI) ให้ทำตามไฟล์นี้ ค่าทั้งหมดดึงมาจากของที่ใช้อยู่จริงใน `app/globals.css`, `tailwind.config.ts`
และคอมโพเนนต์ใน `components/` — ถ้าโค้ดกับไฟล์นี้ไม่ตรงกัน ให้ถือไฟล์นี้เป็นเป้าหมาย แล้วจดลง
"จุดที่ยังไม่สม่ำเสมอ" ท้ายไฟล์

---

## 1. บรรยากาศและแนวคิด (Visual Theme & Atmosphere)

- **ขาว-ดำ เรียบ คม** เหมือนร้านการ์ดที่จัดของเป็นระเบียบ: พื้นขาวนวล ตัวหนังสือดำ เส้นขอบบาง
  สีมีไว้บอก "ความหมาย" (สถานะ, เกม, ราคา) ไม่ได้มีไว้ตกแต่ง
- **คอมมิวนิตี้การ์ดเกมไทย** — ภาษาไทยเป็นหลัก คำศัพท์วงการ (Shop, Events, Deck, Pre-order) ใช้อังกฤษได้
- **มือถือมาก่อน (mobile-first)** ลูกค้าส่วนใหญ่เข้าจาก LINE/Facebook บนมือถือ — ทุกหน้าต้องใช้นิ้วโป้งเดียวได้
  มีแถบเมนูล่าง (BottomNav) ตลอด
- **ความหนาแน่นปานกลาง**: การ์ดสินค้า 2 คอลัมน์บนมือถือ ข้อความสั้น ตรง ไม่มีคำโฆษณาเกินจริง
- สามสีจากโลโก้ (แดง เหลือง น้ำเงิน) คือ "ลายเซ็น" ของแบรนด์ — ใช้น้อย ๆ เป็นจุดเน้นเท่านั้น

## 2. สีและหน้าที่ (Color Palette & Roles)

พื้นฐานใช้สเกล `zinc` ของ Tailwind ทั้งหมด

| บทบาท | Token / class | Hex | ใช้ที่ |
|---|---|---|---|
| พื้นหลังหน้า | `body` / `brand.white` | `#fafafa` | พื้นหลังทุกหน้า |
| พื้นผิว (card, header, nav) | `bg-white` | `#ffffff` | การ์ด, TopBar, BottomNav, modal |
| พื้นผิวรอง | `bg-zinc-50` | `#fafafa` | input, กล่องข้อมูลย่อย, แถบสรุป |
| พื้นผิวเน้นอ่อน | `bg-zinc-100` | `#f4f4f5` | chip ที่ไม่ได้เลือก, badge-pre, skeleton |
| ตัวหนังสือหลัก | `text-zinc-900` / `brand.black` | `#18181b` / `#0a0a0a` | หัวข้อ, ราคา, เนื้อหา |
| ตัวหนังสือรอง | `text-zinc-600`, `text-zinc-700` | | คำอธิบาย, label |
| ตัวหนังสือจางสุดที่อนุญาต | `text-zinc-500` | `#71717a` | วันที่, meta, placeholder — **ห้ามจางกว่านี้บนพื้นขาว** |
| เส้นขอบ | `border-zinc-100` (การ์ด, header), `border-zinc-200` (input, ปุ่ม outline) | | |
| ปุ่มหลัก / สถานะเลือก | `bg-zinc-900 text-white` | `#18181b` | CTA, chip ที่เลือก, badge-new |
| Overlay | `bg-black/40` (มาตรฐาน), `/60` บนรูป | | พื้นหลัง modal/drawer |

**สีสถานะ** (คู่พื้นอ่อน + ตัวหนังสือเข้ม เสมอ):

| สถานะ | พื้น | ตัวหนังสือ | ใช้ที่ |
|---|---|---|---|
| ผิดพลาด / ด่วน / หมด | `bg-red-50` | `text-red-600` / `text-red-700` | error, badge-hot, สต็อกหมด |
| เตือน / รอดำเนินการ | `bg-amber-50` | `text-amber-700` / `text-amber-800` | รอชำระ, พรีออเดอร์ใกล้ปิด |
| สำเร็จ | `bg-green-50` | `text-green-700` | ชำระแล้ว, จองสำเร็จ |
| ข้อมูล / ลิงก์ | `bg-blue-50` | `text-blue-700` | notice, ลิงก์ในข่าว |
| หายาก | `bg-purple-50` | `text-purple-700` | badge-rare |

**สีแบรนด์ (จากโลโก้ C สามสี)** — ใช้เป็นแถบ/จุดเล็ก ๆ เช่นแถบสามสีบนรูปปกข่าว ห้ามใช้เป็นพื้นใหญ่หรือสีปุ่ม:
แดง `#E24B4A` · เหลือง `#F5B301` · น้ำเงิน `#1F5AA6`

**สีประจำเกม** (`TCG_COLOR` ใน `app/events/page.tsx`) — ใช้ระบุเกมในหน้าอีเวนต์เท่านั้น:
Pokemon `#EF9F27` · One Piece `#E24B4A` · MTG `#7F77DD` · Dragon Ball `#1D9E75` · Mixed `#6366f1` · Other `#888888`

**สีของบริการภายนอก** — ใช้เฉพาะปุ่มของบริการนั้น: LINE `#06C755` (hover `#05b34c`), Facebook `#1877F2`

## 3. ตัวอักษร (Typography Rules)

- **ฟอนต์หลัก:** `Noto Sans` + `Noto Sans Thai` (โหลดจาก Google Fonts ใน `app/layout.tsx`, น้ำหนัก 400/500/600/700)
  ตั้งเป็น `font-sans` ใน tailwind แล้ว — ไม่ต้องใส่ font-family เอง
- **ฟอนต์แบรนด์:** `CardlistDisplay` (`public/fonts/CardlistDisplay-Regular.ttf`, class `font-cardlist`) ใช้กับคำว่า
  **The Cardlist ในหัวข้อ/heading เท่านั้น** — ชื่อแบนเนอร์, ชื่อข่าว, ชื่ออีเวนต์, หัวการ์ด, wordmark หลังบ้าน
  - ข้อความที่มาจากฐานข้อมูลให้ห่อด้วย `<BrandText text={...} />` (`components/BrandText.tsx`) ระบบจะเปลี่ยนฟอนต์เฉพาะคำนั้นเอง
  - ข้อความที่เขียนในโค้ดใช้ `<span className="font-cardlist font-normal tracking-wide">The Cardlist</span>`
  - **ห้ามใช้** ในคำอธิบาย เนื้อหาข่าว บทความ กฎระเบียบ ปุ่ม และอีเมล — ส่วนนั้นใช้ Noto Sans/Noto Sans Thai ตามเดิม
  - ฟอนต์มีแค่ A–Z a–z 0–9 และ `- . / :` (ไม่มีภาษาไทย) และมีแค่น้ำหนักปกติ — ใส่ `font-normal` เสมอ ไม่ให้เบราว์เซอร์ทำตัวหนาปลอม
- ภาษาไทยห้ามใช้ `tracking-widest` กับประโยคยาว (สระลอยแยก) — ระยะห่างตัวอักษรกว้างใช้กับคำอังกฤษตัวพิมพ์ใหญ่สั้น ๆ เท่านั้น

| ระดับ | class | ใช้ที่ |
|---|---|---|
| Display | `text-2xl`–`text-3xl font-bold` | หัวหน้า hero, ราคาใหญ่, ยอดรวม |
| Title | `text-lg`–`text-xl font-semibold` | หัวข้อหน้า, ชื่อสินค้าในหน้ารายละเอียด |
| Section | `text-sm font-semibold` | หัว section, ชื่อใน TopBar (`tracking-wide`) |
| Body | `text-sm` | เนื้อหาข่าว, คำอธิบาย (`leading-relaxed`) |
| Small | `text-xs` | ปุ่ม, label, ข้อมูลรอง — **ขนาดที่ใช้มากที่สุด** |
| Meta | `text-[11px]` | วันที่, หมายเหตุ, ข้อความใต้การ์ด |
| Micro | `text-[10px] font-bold` | **เฉพาะ** badge และ label ใน BottomNav |

**ขั้นต่ำ:** หน้าลูกค้าห้ามเล็กกว่า `text-[11px]` ยกเว้น badge/BottomNav ที่ `text-[10px]` — ห้าม `[9px]` หรือ `[8px]`
**Input:** `text-base` บนมือถือ (`sm:text-sm` บนจอใหญ่) เพื่อไม่ให้ iOS ซูมเอง

## 4. คอมโพเนนต์ (Component Stylings)

คลาสกลางอยู่ใน `app/globals.css` (`@layer components`) — ใช้คลาสเหล่านี้ก่อนเสมอ อย่าเขียนสไตล์ปุ่มใหม่ทีละหน้า

**ปุ่ม**
- `.btn-primary` — `bg-zinc-900 text-white text-xs font-semibold px-4 py-3 rounded-xl tracking-wide`
  กด: `active:opacity-80` · ปิด: `disabled:cursor-not-allowed` + ลด opacity · กำลังโหลด: เปลี่ยนข้อความเป็น "กำลัง…" และ disabled
- `.btn-outline` — `border border-zinc-200 text-zinc-700 text-xs font-medium px-4 py-3 rounded-xl` · กด: `active:bg-zinc-50`
- ปุ่ม LINE Login — `bg-[#06C755] text-white font-semibold py-3.5 rounded-2xl text-sm`
- ปุ่มไอคอนอย่างเดียวต้องมี `aria-label` ภาษาไทย และพื้นที่กดอย่างน้อย `w-10 h-10`

**การ์ด** — `.card` = `bg-white border border-zinc-100 rounded-2xl` · ไม่ใส่เงา (เงาสงวนไว้ให้ของที่ลอย ดูข้อ 6)

**Input** — `.input` = `w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-base sm:text-sm placeholder-zinc-500`
โฟกัส: `focus:border-zinc-500` · error: ข้อความ `text-xs text-red-600` ใต้ช่อง เป็นภาษาไทยที่บอกวิธีแก้

**Badge** — `.badge-new` (ดำ), `.badge-hot` (แดง), `.badge-pre` (เทา), `.badge-rare` (ม่วง):
`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-widest` ข้อความอังกฤษตัวใหญ่สั้น ๆ

**Chip / ตัวกรอง** — `rounded-full px-3 py-1.5 text-xs` · เลือกแล้ว `bg-zinc-900 text-white` · ยังไม่เลือก `bg-zinc-100 text-zinc-600`

**TopBar** (`components/TopBar.tsx`) — `sticky top-0 z-40 bg-white border-b border-zinc-100 h-12 px-4`
ซ้าย: ปุ่มย้อนกลับ (กลับหน้าแรกถ้าเข้าจากลิงก์ภายนอก) + ชื่อหน้า `text-sm font-semibold` หรือโลโก้ · ขวา: `rightSlot`

**BottomNav** (`components/BottomNav.tsx`) — `fixed bottom-0 z-50 bg-white border-t border-zinc-100 h-16` 6 เมนู
active `text-zinc-900 font-semibold` + `aria-current="page"` · ไม่ active `text-zinc-500` · ไอคอนเส้น 20px stroke 1.3 (active 1.6)
เนื้อหาหน้าต้องเว้นล่าง (`pb-20` ขึ้นไป) ไม่ให้ถูกเมนูบัง

**Modal / Drawer** — overlay `fixed inset-0 bg-black/40` · กล่อง `bg-white rounded-t-2xl` (drawer จากล่างบนมือถือ)
หรือ `sm:rounded-2xl sm:max-w-md` (กลางจอบนจอใหญ่) · ต้องมี `role="dialog"` `aria-modal="true"` และเรียก
`useModal(open, onClose)` จาก `lib/use-modal.ts` (Esc ปิด + ล็อกการเลื่อนหน้า) · ถ้าบังคับยอมรับ (เช่นกฎบูธ) ปุ่มยืนยันต้อง disabled จนกว่าจะติ๊ก

**สถานะหน้า** — ทุกหน้าที่โหลดข้อมูลต้องมีครบ 3 แบบ: กำลังโหลด (skeleton `bg-zinc-100 animate-pulse`),
ว่าง (ข้อความ + ปุ่มไปทำต่อ), ผิดพลาด (กล่อง `bg-red-50 text-red-700` + ปุ่ม "ลองใหม่")

**Toast** — `bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-lg` `role="status"` กว้างไม่เกิน `calc(100vw-32px)`

## 5. Layout และระยะห่าง (Layout Principles)

- ระยะขอบหน้า: `px-4` (มาตรฐาน), `px-5` ในส่วนเนื้อหาที่ต้องการหายใจมากขึ้น
- ระยะระหว่างองค์ประกอบ: `gap-2` (ในกลุ่ม), `gap-3` (ระหว่างการ์ด), `gap-4` ขึ้นไป (ระหว่าง section) — ใช้ขั้น 4px ของ Tailwind เท่านั้น
- กริดสินค้า: `grid-cols-2` บนมือถือ → `sm:grid-cols-3` → `md:grid-cols-4`
- ความกว้างเนื้อหาบนจอใหญ่: บทความ/ฟอร์ม `lg:max-w-3xl lg:mx-auto`, modal `max-w-md`, กล่องเล็ก `max-w-sm`
- มุมโค้ง: `rounded-xl` (ปุ่ม, input) · `rounded-2xl` (การ์ด, modal) · `rounded-full` (chip, avatar, ปุ่มกลม) · `rounded-lg` (รูปย่อ, กล่องย่อย)

## 6. ความลึกและเงา (Depth & Elevation)

เว็บนี้ "แบน" — แยกชั้นด้วยสีพื้นและเส้นขอบ ไม่ใช่เงา

| ชั้น | วิธี |
|---|---|
| 0 พื้นหน้า | `#fafafa` |
| 1 การ์ด / header / nav | `bg-white` + `border-zinc-100` (ไม่มีเงา) |
| 2 ของลอย (toast, ปุ่มลอย, dropdown) | `shadow-sm` – `shadow-lg` |
| 3 modal / drawer | overlay `bg-black/40` + กล่อง `bg-white` (`shadow-2xl` ได้) |

z-index: TopBar `z-40` · BottomNav `z-50` · modal ต้องสูงกว่า `z-50`

## 7. ควรทำ / ห้ามทำ (Do's and Don'ts)

**ควรทำ**
- ใช้คลาสกลาง (`.btn-primary`, `.card`, `.input`, `.badge-*`) ก่อนเขียนสไตล์ใหม่
- ข้อความ error เป็นภาษาไทย บอกว่าเกิดอะไรและต้องทำอะไรต่อ (ดู `lib/auth-next.ts` `thaiAuthError`, `lib/api-error.ts`)
- ราคาเขียน `฿1,234` (มีจุลภาค) · วันที่แบบไทย `20 พ.ย. 2569` (ดู `thai_date` ใน DB และ `toLocaleDateString("th-TH")`)
- ทุกหน้าที่ต้องล็อกอินส่ง `?next=` กลับหน้าเดิมหลังล็อกอิน (`loginHref` ใน `lib/auth-next.ts`)
- รูปที่ไม่มีความหมายใส่ `alt=""` · รูปสินค้าใส่ชื่อสินค้า

**ห้ามทำ**
- **โลโก้:** ใช้ไฟล์ `public/images/cardlist-logo.png` (ตัว C สามสี) เท่านั้น — ห้ามวาดเอง ห้ามเปลี่ยนสี ห้ามใส่กรอบ
- ห้ามตัวหนังสือจางกว่า `text-zinc-500` บนพื้นขาว และห้ามเล็กกว่าขั้นต่ำในข้อ 3
- ห้าม `outline-none` โดยไม่มี focus อื่นแทน — มี `html :focus-visible` ใน globals.css แล้ว อย่าไปลบ
- ห้ามล็อกการซูม (`maximumScale`) ใน viewport
- ห้ามใช้ gradient สีจัด, emoji แทนไอคอน, เงาหนาบนการ์ด
- ห้ามใช้สีแบรนด์สามสีหรือสีเกมเป็นสีปุ่มหลัก
- ห้ามทำ `div onClick` แทนปุ่ม — ใช้ `<button>` / `<Link>` จริง

## 8. Responsive (Responsive Behavior)

- ออกแบบที่ 375px ก่อน แล้วขยาย: `sm` 640 · `md` 768 · `lg` 1024
- พื้นที่กดขั้นต่ำ 44×44px (ปุ่มใช้ `py-3` ขึ้นไป, ปุ่มไอคอน `w-10 h-10` + padding)
- BottomNav แสดงทุกขนาดจอ · modal เป็น drawer จากล่างบนมือถือ และกล่องกลางจอตั้งแต่ `sm`
- ตารางกว้าง (หลังบ้าน, ผังบูธ) ใส่ในกล่อง `overflow-x-auto` ไม่ให้หน้าทั้งหน้าเลื่อนข้าง
- ผังบูธ (`components/BoothMap.tsx`) ซูม/เลื่อนในกล่องของตัวเอง

## 9. คำสั่งสำหรับ AI (Agent Prompt Guide)

**สรุปสีแบบเร็ว:** พื้น `#fafafa` · การ์ด `white` + `border-zinc-100` · ตัวหนังสือ `zinc-900` / รอง `zinc-600` / จางสุด `zinc-500`
· ปุ่มหลัก `zinc-900` · error `red-50/red-700` · success `green-50/green-700` · warning `amber-50/amber-700` · แบรนด์ `#E24B4A #F5B301 #1F5AA6` (จุดเน้นเท่านั้น)

**ตัวอย่างคำสั่ง**
- "สร้างหน้า [ชื่อหน้า] ให้ตรงกับ DESIGN.md: มี TopBar แบบ showBack, เนื้อหา `px-4`, ใช้ `.card` และ `.btn-primary`, มีสถานะโหลด/ว่าง/ผิดพลาดครบ, เว้นล่างให้ BottomNav"
- "ตรวจหน้า [path] เทียบกับ DESIGN.md แล้วสรุปจุดที่ไม่ตรง ยังไม่ต้องแก้"
- "ทำ modal [ชื่อ] ตามข้อ 4 ของ DESIGN.md (role=dialog, useModal, drawer บนมือถือ)"
- "ทำหน้าประกาศงานอีเวนต์ด้วยธีมงานอีเวนต์ใน DESIGN.md (ภาคผนวก A)"

---

## ภาคผนวก A — ธีมงานอีเวนต์ (Siam Paragon)

ธีมย่อยสำหรับงาน **The Cardlist : The Community of Card Game** (20–22 พ.ย. 2569, Siam Paragon) ใช้ได้กับ
หน้า /booth, หน้าประกาศงาน, แบนเนอร์ และสื่อโซเชียล — **หน้าร้านหลัก (Shop, News, Profile) ยังเป็นขาว-ดำตามข้อ 1–8**
อ้างอิงจาก KV ที่ทำไว้ (canvas "KV The Cardlist @ Siam Paragon") ซึ่งตีความจากฮอลล์จริง: เพดานวงรีขอบไฟทอง แชนเดอเลียร์คริสตัล เสาโครเมียม

| บทบาท | Hex |
|---|---|
| พื้น (ดำอุ่น) | `#0B0A08` |
| พื้นการ์ด | `#161410` / `#13110D` |
| ทองแชมเปญ (เส้น, label) | `#C9A96E` |
| ทองอ่อน (ตัวเน้น, ลิงก์) | `#E8D5A8` |
| ครีม (ตัวหนังสือหลัก) | `#F2EBDD` |
| ตัวหนังสือรอง | `#CFC6B4` |
| โครเมียม (ตัวเลขวันที่) | `#E9EBEE` |

- ฟอนต์: หัวข้ออังกฤษ `Cormorant Garamond` (ตัวเอียงสำหรับคำเน้น) · ไทย `Noto Serif Thai` · คำว่า THE CARDLIST ใช้ `CardlistDisplay`
  (บนเว็บถ้าไม่อยากโหลดฟอนต์เพิ่ม ใช้ Noto Sans/Noto Sans Thai เดิมได้ แต่คงสีตามตาราง)
- ลวดลาย: เส้นวงรีซ้อนทองโปร่ง (≈25% opacity), จุดไฟระยิบแบบคริสตัล, การ์ดสามใบเรียงพัดกรอบทอง
- ตัวหนังสือบนพื้นดำต้องเป็นครีม/ทองอ่อน — ทองเข้ม `#C9A96E` ใช้กับ label ตัวใหญ่ ≥ 16px เท่านั้น
- แถบสามสีแบรนด์ยังใส่ได้เป็นจุดเล็ก ๆ

---

## จุดที่ยังไม่สม่ำเสมอ (บันทึก ณ 14 ต.ค. 2569 — ยังไม่ได้แก้)

1. **โลโก้ไม่ตรงกฎ:** `components/TopBar.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`,
   `app/reset-password/page.tsx`, `app/profile/page.tsx`, `app/admin/layout.tsx`, `app/admin/login/page.tsx`
   ยังใช้ `logo-long.jpg` / `logo-square.*` แทน `cardlist-logo.png`
2. **ตัวอักษรเล็กเกินในหลังบ้าน:** `text-[9px]` / `text-[8px]` ยังอยู่ใน 16 ไฟล์ใต้ `app/admin/` (หน้าลูกค้าแก้แล้ว)
3. **`text-[10px]` ใช้เกินขอบเขต badge/nav** ในบางหน้า: `app/profile/page.tsx` (15 จุด), `app/shop/page.tsx` (11),
   `app/thaiartistcards/page.tsx` (8), `app/events/page.tsx` (6), `app/page.tsx` (5), `app/profile/collection/page.tsx` (5) — ควรไล่เช็กว่าจุดไหนเป็นเนื้อหาแล้วขยับเป็น `[11px]`
4. **Token ใน tailwind ไม่ได้ใช้:** `brand.black/white/gray` ไม่มีที่ใช้ในโค้ดเลย (ทุกหน้าใช้ zinc ตรง ๆ) และ `brand.gray` `#888780` ไม่อยู่ในสเกล zinc — ควรลบหรือกำหนดหน้าที่
5. **สีแบรนด์สามสียังไม่เป็น token:** ตอนนี้เขียน hex ตรงในโค้ด (เช่นรูปปกข่าว) — ควรเพิ่ม `brand.red/yellow/blue` ใน tailwind
6. **สีเกม `TCG_COLOR`** อยู่ในไฟล์หน้าอีเวนต์ไฟล์เดียว — ถ้าจะใช้ที่อื่นควรย้ายไป `lib/`
7. **Overlay** ใช้หลายค่า (`bg-black/30` ถึง `/60`, `bg-zinc-900/80`) — มาตรฐานคือ `/40` สำหรับ modal
