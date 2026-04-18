# The Cardlist — TCG Platform

## วิธีติดตั้งและรัน

### 1. ติดตั้ง dependencies
```bash
npm install
```

### 2. ตั้งค่า Supabase
1. ไปที่ [supabase.com](https://supabase.com) → สร้าง project ใหม่
2. เปิด SQL Editor แล้วรันไฟล์ `supabase-schema.sql` ทั้งหมด
3. ไปที่ Settings → API → copy URL และ anon key
4. คัดลอกไฟล์ `.env.local.example` แล้วเปลี่ยนชื่อเป็น `.env.local`
5. ใส่ค่า Supabase ลงในไฟล์ `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

### 3. รันโปรเจกต์
```bash
npm run dev
```
เปิด http://localhost:3000

---

## โครงสร้างหน้า

| หน้า | URL | คำอธิบาย |
|------|-----|----------|
| Homepage | `/` | หน้าแรก — Hero, Quick links, Events, News |
| Shop | `/shop` | ร้านค้า — Filter, Search, Cart |
| Events | `/events` | อีเวนต์และจองโต๊ะ |
| News | `/news` | ข่าวสารและบทความ |
| Login | `/login` | เข้าสู่ระบบ |
| Register | `/register` | สมัครสมาชิก |
| Profile | `/profile` | โปรไฟล์, คะแนน, Tier, QR Code |

## Database Tables
- `profiles` — ข้อมูลสมาชิก + Tier + Points
- `products` — สินค้าทั้งหมด
- `events` — อีเวนต์
- `bookings` — การจองอีเวนต์ + QR Code
- `news` — บทความ
- `orders` / `order_items` — คำสั่งซื้อ

## Tech Stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **Font**: Noto Sans + Noto Sans Thai
