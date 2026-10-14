-- สถานะ "unpaid" = ทีมงานจองให้ กันโต๊ะถาวร แต่ยังไม่ได้รับเงิน (เช่น ตกลงจ่ายสิ้นเดือน)
alter table public.booth_bookings drop constraint if exists booth_bookings_status_check;
alter table public.booth_bookings add constraint booth_bookings_status_check
  check (status = any (array['hold','unpaid','paid','expired','cancelled','needs_refund']));
