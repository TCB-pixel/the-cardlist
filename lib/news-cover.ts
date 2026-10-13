// รูปปกข่าว: ใช้รูปที่แอดมินใส่ก่อน ถ้าไม่มีใช้รูปที่ระบบสร้างจากชื่อข่าว
export function newsCover(n: { slug: string; image_url?: string | null }): string {
  return n.image_url || `/api/news-cover/${encodeURIComponent(n.slug)}`;
}
