import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

/** نقشه‌ی سایت برای گوگل: صفحات اصلی + مباحث، بسته‌ها و مقالات منتشرشده */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics: MetadataRoute.Sitemap = [
    { url: SITE_URL, priority: 1, changeFrequency: "weekly", lastModified: now },
    { url: `${SITE_URL}/javad-partovi`, priority: 0.95, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/tadris-shimi`, priority: 0.9, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/shimi-konkur`, priority: 0.9, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/shimi-dahom`, priority: 0.85, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/shimi-yazdahom`, priority: 0.85, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/shimi-davazdahom`, priority: 0.85, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/courses`, priority: 0.85, changeFrequency: "weekly", lastModified: now },
    { url: `${SITE_URL}/articles`, priority: 0.8, changeFrequency: "weekly", lastModified: now },
    { url: `${SITE_URL}/gallery`, priority: 0.6, changeFrequency: "monthly", lastModified: now },
  ];
  try {
    const [topics, bundles, articles] = await Promise.all([
      db.topic.findMany({ where: { published: true }, select: { id: true, createdAt: true } }),
      db.bundle.findMany({ where: { active: true }, select: { id: true, createdAt: true } }),
      db.article.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    ]);
    return [
      ...statics,
      ...topics.map((t) => ({ url: `${SITE_URL}/courses/${t.id}`, lastModified: t.createdAt, priority: 0.7, changeFrequency: "weekly" as const })),
      ...bundles.map((b) => ({ url: `${SITE_URL}/courses/bundle-${b.id}`, lastModified: b.createdAt, priority: 0.6, changeFrequency: "monthly" as const })),
      ...articles.map((a) => ({ url: `${SITE_URL}/articles/${encodeURIComponent(a.slug)}`, lastModified: a.updatedAt, priority: 0.75, changeFrequency: "monthly" as const })),
    ];
  } catch {
    return statics;
  }
}
