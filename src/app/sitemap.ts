import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { canonicalUrl } from "@/lib/page-meta";
import { liveRoutes } from "@/lib/site-routes";
import { GALLERY_PHOTOS, THIN_TOPIC_DESC } from "@/lib/seo";

export const revalidate = 3600;

/** تاریخ ثابت محتوا (YYYY-MM-DD در SEO_ROUTES) → Date؛ با هر بار ساخت نقشه عوض نمی‌شود */
const day = (d: string) => new Date(`${d}T00:00:00Z`);

/**
 * نقشه‌ی سایت برای گوگل. lastmod همیشه تاریخ واقعی تغییر محتواست (نه «الان»)، پس دو بار ساخت پشت‌سرهم یکسان است:
 * - صفحه‌های live در SEO_ROUTES با updated ثابت هر صفحه (صفحه‌ی غیر live هرگز اینجا نمی‌آید)؛
 *   /articles فقط وقتی مقاله‌ی منتشرشده هست و /gallery فقط وقتی عکس دارد؛
 * - مقاله‌های منتشرشده (updatedAt؛ شمارنده‌ی بازدید دیگر آن را عوض نمی‌کند)؛
 * - مباحث منتشرشده‌ای که ویدیوی منتشرشده یا توضیح کافی دارند (بقیه noindex هستند)؛ lastmod = جدیدترین ویدیو؛
 * - بسته‌های فعال.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = liveRoutes();
  const entry = (path: string, lastModified: Date, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) => ({
    url: canonicalUrl(path),
    lastModified,
    priority,
    changeFrequency,
  });
  const statics = (skip: Set<string>) => routes.filter((r) => !skip.has(r.path)).map((r) => entry(r.path, day(r.updated), r.priority, r.changeFrequency));
  try {
    const [topics, bundles, articles, photos] = await Promise.all([
      db.topic.findMany({
        where: { published: true },
        select: { id: true, createdAt: true, description: true, videos: { where: { published: true }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      db.bundle.findMany({ where: { active: true }, select: { id: true, createdAt: true } }),
      db.article.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
      db.photo.count({ where: GALLERY_PHOTOS }),
    ]);
    const skip = new Set<string>();
    if (articles.length === 0) skip.add("/articles");
    if (photos === 0) skip.add("/gallery");
    return [
      ...statics(skip),
      ...articles.map((a) => entry(`/articles/${a.slug}`, a.updatedAt, 0.75, "monthly")),
      ...topics
        .filter((t) => t.videos.length > 0 || (t.description?.trim().length ?? 0) >= THIN_TOPIC_DESC)
        .map((t) => entry(`/courses/${t.id}`, t.videos[0]?.createdAt ?? t.createdAt, 0.7, "weekly")),
      ...bundles.map((b) => entry(`/courses/bundle-${b.id}`, b.createdAt, 0.6, "monthly")),
    ];
  } catch {
    return statics(new Set());
  }
}
