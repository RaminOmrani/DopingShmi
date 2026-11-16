/**
 * بررسی خودکار محتوای یک فصل بر اساس معیار کیفیت (راهنما: scratchpad/seo-chapter-guide.md).
 * خالص است (بدون React)؛ آزمون chapters.test.ts همه‌ی فصل‌های آماده را با آن می‌سنجد.
 */
import { chemPlain, chemTextPlain } from "../../components/seo/chem-format";
import { GRADE_PAGES } from "../../lib/syllabus";
import type { ChapterContent, Rich } from "./types";

export interface ChapterIssue {
  level: "error" | "warn";
  where: string;
  msg: string;
}

/** همان شمارش کلمه‌ی seo-check (هر تکه‌ی دارای حرف یا رقم) */
export const countWords = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
/** متن دیدنی یک رشته‌ی Rich */
export const plain = (t: Rich) => chemTextPlain(t);
const words = (t: Rich | Rich[] | undefined) => (Array.isArray(t) ? t : t ? [t] : []).reduce((s, x) => s + countWords(plain(x)), 0);

const ARABIC = /[يك]/;
/** همان الگوی فرمول خام seo-check، روی متن بیرون از {{…}} */
const RAW_FORMULA = /(?<![A-Za-z0-9_/.:#=-])[A-Z][a-z]?\d/;
const RAW_ARROW = /(->|<=>|=>)/;
const outside = (t: string) => t.replace(/\{\{[\s\S]*?\}\}/g, " ");

/** همه‌ی رشته‌های نمایشی فصل با محل آن‌ها */
export function chapterStrings(c: ChapterContent): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const add = (where: string, t: Rich | Rich[] | undefined) => (Array.isArray(t) ? t : t ? [t] : []).forEach((text, i) => out.push({ where: Array.isArray(t) ? `${where}[${i}]` : where, text }));
  add("h1", c.h1);
  add("metaTitle", c.metaTitle);
  add("metaDescription", c.metaDescription);
  add("intro", c.intro);
  c.sections.forEach((s) => {
    const w = `sections.${s.id}`;
    add(`${w}.heading`, s.heading);
    add(`${w}.paragraphs`, s.paragraphs);
    add(`${w}.bullets`, s.bullets);
    s.formula?.vars.forEach((v, i) => add(`${w}.formula.vars[${i}]`, v.desc));
    add(`${w}.formula.note`, s.formula?.note);
    add(`${w}.example.question`, s.example?.question);
    add(`${w}.example.steps`, s.example?.steps);
    add(`${w}.example.answer`, s.example?.answer);
    add(`${w}.mistake`, s.mistake);
  });
  add("konkurTips", c.konkurTips);
  add("teacherNotes", c.teacherNotes);
  c.sampleQuestions.forEach((q, i) => {
    add(`sampleQuestions[${i}].q`, q.q);
    add(`sampleQuestions[${i}].answer`, q.answer);
  });
  return out;
}

export function validateChapter(c: ChapterContent): ChapterIssue[] {
  const issues: ChapterIssue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: "error", where, msg });
  const warn = (where: string, msg: string) => issues.push({ level: "warn", where, msg });
  const chapter = GRADE_PAGES[c.grade]?.chapters[c.n - 1];

  if (!chapter) err("grade/n", `فصل ${c.n} در پایه‌ی ${c.grade} وجود ندارد`);
  else if (c.title !== chapter.title) err("title", `عنوان با syllabus.ts یکی نیست: «${c.title}» ≠ «${chapter.title}»`);
  if (chapter && !c.h1.includes(chapter.title)) warn("h1", "H1 عنوان کتاب درسی فصل را ندارد");

  const tl = [...c.metaTitle].length;
  if (tl > 60) err("metaTitle", `عنوان ${tl} نویسه است (حداکثر ۶۰)`);
  const dl = [...c.metaDescription].length;
  if (dl < 120 || dl > 160) err("metaDescription", `توضیح ${dl} نویسه است (۱۲۰ تا ۱۶۰)`);
  if (!c.metaDescription.includes("نمونه سوال")) warn("metaDescription", "«نمونه سوال» در توضیح نیامده است");
  if (words(c.intro) > 120) err("intro", `مقدمه ${words(c.intro)} کلمه است (حداکثر ۱۲۰)`);

  if (c.sections.length < 4 || c.sections.length > 6) err("sections", `${c.sections.length} بخش (باید ۴ تا ۶)`);
  const ids = new Set<string>();
  c.sections.forEach((s) => {
    const w = `sections.${s.id}`;
    if (!/^[a-z][a-z0-9-]*$/.test(s.id)) err(w, "شناسه باید لاتین کوچک با خط تیره باشد");
    if (ids.has(s.id)) err(w, "شناسه‌ی تکراری");
    ids.add(s.id);
    const n = words(s.paragraphs) + words(s.bullets);
    if (n < 150 || n > 250) warn(w, `متن بخش ${n} کلمه است (۱۵۰ تا ۲۵۰)`);
    if (s.example && s.example.steps.length < 2) warn(`${w}.example`, "مثال حل‌شده کمتر از ۲ مرحله دارد");
  });
  if (c.sections.filter((s) => s.example).length < 3) warn("sections", "کمتر از ۳ مثال حل‌شده");
  if (c.sections.filter((s) => s.mistake).length < 3) warn("sections", "کمتر از ۳ کادر «اشتباه رایج»");

  if (c.konkurTips.length < 5 || c.konkurTips.length > 8) err("konkurTips", `${c.konkurTips.length} نکته‌ی تستی (باید ۵ تا ۸)`);
  if (c.sampleQuestions.length < 8 || c.sampleQuestions.length > 10) err("sampleQuestions", `${c.sampleQuestions.length} سؤال (باید ۸ تا ۱۰)`);
  c.sampleQuestions.forEach((q, i) => {
    if (!ids.has(q.subtopic)) err(`sampleQuestions[${i}]`, `subtopic «${q.subtopic}» با هیچ بخشی یکی نیست`);
  });
  if (!c.relatedTools.length) warn("relatedTools", "ابزار مرتبطی ثبت نشده است");
  if (c.review.teacherPrompts.length < 2) warn("review.teacherPrompts", "کمتر از ۲ پرسش برای استاد");

  const all = chapterStrings(c);
  let formulas = 0;
  for (const { where, text } of all) {
    if (ARABIC.test(text)) err(where, "«ی» یا «ک» عربی دارد");
    if (text.includes("لیسانس")) err(where, "واژه‌ی «لیسانس» آمده است");
    if ((text.match(/\{\{/g) || []).length !== (text.match(/\}\}/g) || []).length) err(where, "{{ و }} جفت نیستند");
    if ((text.match(/\*\*/g) || []).length % 2) err(where, "** جفت نیست");
    if (text.includes("}}}")) err(where, "«}}}»: فرمول داخل {{…}} نباید با «}» تمام شود (Fe^{3+} را Fe^3+ بنویسید)");
    formulas += (text.match(/\{\{/g) || []).length;
    // هر {{…}} بدون شکستن خط نمایش داده می‌شود؛ بلندتر از ~۳۰ نویسه در موبایل ۳۶۰ پیکسلی جا نمی‌شود
    for (const m of text.matchAll(/\{\{([\s\S]+?)\}\}/g)) {
      const len = [...chemPlain(m[1])].length;
      if (len > 32 && !/->|→|<=>|⇌/.test(m[1])) warn(where, `فرمول ${len} نویسه‌ای «${m[1]}» در موبایل جا نمی‌شود؛ آن را به چند {{…}} بشکنید`);
    }
    const out = outside(text);
    if (RAW_FORMULA.test(out)) err(where, `فرمول خام بیرون از {{…}}: «${RAW_FORMULA.exec(out)![0]}…»`);
    if (RAW_ARROW.test(out)) err(where, "پیکان خام بیرون از {{…}}");
    if (/[0-9]/.test(out)) warn(where, "رقم لاتین بیرون از {{…}} (در متن فارسی رقم فارسی بنویسید)");
    if (/(^|[\s«(])(ن?می) (?=[؀-ۿ])/.test(out)) warn(where, "«می» جدا با فاصله؛ نیم‌فاصله (ZWNJ) بگذارید");
    if (/[؀-ۿ] (ها|های|تر|ترین)(?=[\s،؛.:)»]|$)/.test(out)) warn(where, "پسوند جدا با فاصله؛ نیم‌فاصله بگذارید");
  }
  if (formulas < 4) err("formulas", `فقط ${formulas} فرمول با {{…}} (حداقل ۴)`);
  const total = all.filter((x) => !x.where.startsWith("meta")).reduce((s, x) => s + countWords(plain(x.text)), 0);
  if (total < 1500) err("words", `مجموع متن ${total} کلمه است (حداقل ۱۵۰۰)`);
  return issues;
}

/** مجموع کلمه‌های متن دیدنی فصل (بدون عنوان و توضیح متا) */
export const chapterWordCount = (c: ChapterContent) =>
  chapterStrings(c).filter((x) => !x.where.startsWith("meta")).reduce((s, x) => s + countWords(plain(x.text)), 0);
