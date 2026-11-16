/**
 * فهرست محتوای ۱۰ فصل. هر فایل export پیش‌فرض دارد: محتوای آماده (defineChapter) یا جای خالی (chapterStub).
 * فصل جای خالی صفحه‌ی ۴۰۴ می‌دهد؛ برای افزودن فصل فقط فایل همان فصل را پر کنید.
 */
import type { GradeKey } from "../../lib/syllabus";
import type { ChapterContent, ChapterEntry } from "./types";
import g10f1 from "./g10-f1";
import g10f2 from "./g10-f2";
import g10f3 from "./g10-f3";
import g11f1 from "./g11-f1";
import g11f2 from "./g11-f2";
import g11f3 from "./g11-f3";
import g12f1 from "./g12-f1";
import g12f2 from "./g12-f2";
import g12f3 from "./g12-f3";
import g12f4 from "./g12-f4";

export type { ChapterContent, ChapterEntry } from "./types";

/** همه‌ی فصل‌ها به ترتیب پایه و شماره */
export const CHAPTER_ENTRIES: readonly ChapterEntry[] = [g10f1, g10f2, g10f3, g11f1, g11f2, g11f3, g12f1, g12f2, g12f3, g12f4];

/** محتوای آماده‌ی یک فصل، یا null (جای خالی یا ناموجود) */
export function getChapter(g: GradeKey, n: number): ChapterContent | null {
  const c = CHAPTER_ENTRIES.find((x) => x.grade === g && x.n === n);
  return c && c.status === "ready" ? c : null;
}

/** فصل‌های آماده */
export const readyChapters = (): ChapterContent[] => CHAPTER_ENTRIES.filter((c): c is ChapterContent => c.status === "ready");
