import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { db } from "./db";
import type { SiteContent } from "./settings";

/** عکس استاد: اول عکس آپلودشده در بخش «عکس اصلی استاد»، بعد فایل پیش‌فرض */
export async function teacherPhoto(site: SiteContent) {
  const p = await db.photo.findFirst({ where: { section: "TEACHER", visible: true }, orderBy: { order: "asc" } });
  if (p) return p.url;
  const local = site.teacherPhoto.startsWith("/images/") && existsSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", site.teacherPhoto));
  return local ? site.teacherPhoto : "/images/teacher-placeholder.svg";
}
