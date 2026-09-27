import { db } from "@/lib/db";
import { GalleryGrid } from "@/components/site/GalleryGrid";
import { Images } from "lucide-react";

export const metadata = { title: "گالری همایش‌ها" };
export const revalidate = 60;

export default async function Gallery() {
  const photos = await db.photo.findMany({ where: { visible: true, section: { in: ["CONFERENCE", "GALLERY"] } }, orderBy: [{ order: "asc" }, { createdAt: "desc" }] });
  return (
    <main className="mx-auto max-w-7xl px-5 pb-10 pt-32">
      <p className="mb-2 text-sm font-bold text-cyan">گالری</p>
      <h1 className="section-title mb-10">همایش‌ها و <span className="text-gradient">لحظه‌ها</span></h1>
      {photos.length ? (
        <GalleryGrid photos={photos.map((p) => ({ id: p.id, url: p.url, thumbUrl: p.thumbUrl, title: p.title, caption: p.caption, eventName: p.eventName }))} />
      ) : (
        <div className="card p-16 text-center text-white/50"><Images className="mx-auto mb-3 size-10" />به‌زودی عکس‌های همایش‌ها اینجا قرار می‌گیرند.</div>
      )}
    </main>
  );
}
