import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || "https://quekunle.vercel.app"}/sitemap.xml`,
    host: process.env.NEXT_PUBLIC_SITE_URL || "https://quekunle.vercel.app",
  };
}
