import type { Metadata } from "next";
import { Images } from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { GALLERY_PHOTOS } from "@/lib/seo";
import { pageMeta, eduGraph } from "@/lib/page-meta";
import { crumbsFor } from "@/lib/site-routes";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/seo/EduChrome";
import { GalleryGrid } from "@/components/site/GalleryGrid";

export const revalidate = 60;

const PATH = "/gallery";
const TITLE = "گالری همایش‌های شیمی | دوپینگ شیمی";
const desc = (teacher: string, city: string) =>
  `عکس‌های همایش‌ها و کلاس‌های شیمی استاد ${teacher} در ${city}؛ لحظه‌هایی از همایش‌های جمع‌بندی دوپینگ شیمی برای دانش‌آموزان دهم، یازدهم، دوازدهم و کنکور.`;

const loadPhotos = () => db.photo.findMany({ where: GALLERY_PHOTOS, orderBy: [{ order: "asc" }, { createdAt: "desc" }] });

export async function generateMetadata(): Promise<Metadata> {
  const [s, count] = await Promise.all([getSetting("site"), db.photo.count({ where: GALLERY_PHOTOS })]);
  // گالری خالی فقط «به‌زودی» دارد: noindex,follow و بیرون از نقشه‌ی سایت تا عکسی اضافه شود
  return pageMeta({ title: TITLE, description: desc(s.teacherName, s.city || "مشهد"), path: PATH, noindex: count === 0 });
}

export default async function Gallery() {
  const [s, photos] = await Promise.all([getSetting("site"), loadPhotos()]);
  const crumbs = crumbsFor(PATH);
  return (
    <main className="mx-auto max-w-7xl px-5 pb-10 pt-32">
      <JsonLd data={eduGraph(s, { path: PATH, title: TITLE, description: desc(s.teacherName, s.city || "مشهد"), type: "CollectionPage", breadcrumb: crumbs })} />
      <Breadcrumbs items={crumbs} />
      <p className="mb-2 text-sm font-bold text-cyan">گالری</p>
      <h1 className="section-title mb-4">همایش‌ها و <span className="text-gradient">لحظه‌ها</span></h1>
      <p className="mb-10 max-w-2xl leading-8 text-white/60">عکس‌هایی از همایش‌های جمع‌بندی و کلاس‌های شیمی استاد {s.teacherName} در {s.city || "مشهد"}.</p>
      {photos.length ? (
        <GalleryGrid photos={photos.map((p) => ({ id: p.id, url: p.url, thumbUrl: p.thumbUrl, title: p.title, caption: p.caption, eventName: p.eventName }))} />
      ) : (
        <div className="card p-16 text-center text-white/50"><Images className="mx-auto mb-3 size-10" />به‌زودی عکس‌های همایش‌ها اینجا قرار می‌گیرند.</div>
      )}
    </main>
  );
}
