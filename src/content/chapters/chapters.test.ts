/**
 * آزمون محتوای فصل‌ها (اجرا: node --import tsx --test src/content/chapters/chapters.test.ts).
 * خطاها آزمون را رد می‌کنند؛ هشدارها فقط چاپ می‌شوند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CHAPTER_ENTRIES, getChapter, readyChapters } from "./index";
import { chapterWordCount, validateChapter } from "./validate";
import { GRADE_PAGES } from "../../lib/syllabus";

test("برای هر فصل syllabus یک ورودی (آماده یا جای خالی) هست", () => {
  const want = Object.values(GRADE_PAGES).flatMap((g) => g.chapters.map((_, i) => `${g.key}-${i + 1}`));
  assert.deepEqual(CHAPTER_ENTRIES.map((c) => `${c.grade}-${c.n}`), want);
});

test("فصل نمونه (شیمی دهم، فصل اول) آماده است", () => {
  assert.ok(getChapter("G10", 1));
  assert.equal(getChapter("G10", 9), null);
});

for (const c of readyChapters()) {
  test(`معیار کیفیت: ${c.grade} فصل ${c.n} (${chapterWordCount(c)} کلمه)`, () => {
    const issues = validateChapter(c);
    for (const i of issues.filter((x) => x.level === "warn")) console.log(`  ⚠ ${i.where}: ${i.msg}`);
    const errors = issues.filter((x) => x.level === "error");
    assert.deepEqual(errors, [], errors.map((e) => `${e.where}: ${e.msg}`).join("\n"));
  });
}
