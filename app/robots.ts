import type { MetadataRoute } from "next";

const SITE = "https://thecardlistbkk.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // หลังบ้าน API และหน้าส่วนตัวของลูกค้าไม่ควรโผล่ในผลค้นหา
        disallow: ["/admin", "/api", "/profile", "/orders", "/checkout", "/shop/success"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
