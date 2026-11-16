/**
 * کنترل خودکار قالب و کیفیت داده‌ی آزمون‌ها (برای تست‌ها و نویسندگان سؤال).
 * اجرا: node --import tsx --test src/content/quizzes/*.test.ts src/components/quiz/*.test.ts
 * این کنترل جای بازبینی علمی را نمی‌گیرد؛ فقط خطاهای قالبی، نگارشی و پوششی را می‌گیرد.
 */
import { GRADE_PAGES } from "@/lib/syllabus";
import { chapterCount } from "@/lib/site-routes";
import { faNum } from "@/lib/utils";
import { MAX_QUESTIONS, MIN_QUESTIONS, quizTitle } from "./index";
import type { QuizContent } from "./types";

export interface QuizReport {
  errors: string[];
  warnings: string[];
}

const LEVELS = new Set(["آسان", "متوسط", "دشوار"]);
/** بیشترین سهم مجاز یک شماره‌ی گزینه به‌عنوان پاسخ درست */
export const MAX_LETTER_SHARE = 0.4;
/** حداقل سؤال محاسباتی برای فصل‌های محاسباتی (هشدار) */
export const MIN_CALC = 4;

/** حذف نشانه‌گذاری برای شمارش واژه/نویسه: {{…}} و [[…]] به یک نشانه‌ی خنثی، ** حذف */
export const stripMarkup = (s: string) => s.replace(/\{\{[\s\S]+?\}\}/g, "F").replace(/\[\[[\s\S]+?\]\]/g, "M").replace(/\*\*/g, "");

/** متن بیرون از {{…}} و [[…]] (نثر فارسی) */
const prose = (s: string) => s.replace(/\{\{[\s\S]+?\}\}/g, " ").replace(/\[\[[\s\S]+?\]\]/g, " ");

/** شمار واژه‌ها (پس از حذف نشانه‌گذاری) */
export const wordCount = (s: string) => stripMarkup(s).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** شمار جمله‌ها: پایان با «.» «؟» «!» (عدد اعشاری فارسی با «٫» نوشته می‌شود) */
export const sentenceCount = (s: string) => stripMarkup(s).split(/[.!؟?]+(?:\s|$)/).filter((x) => x.trim()).length;

/** خطاهای نگارشی و نشانه‌گذاری یک متن */
function textProblems(label: string, s: string): string[] {
  const out: string[] = [];
  if (/[يك]/.test(s)) out.push(`${label}: «ي» یا «ك» عربی دارد (باید ی/ک فارسی باشد)`);
  if (s.includes("لیسانس")) out.push(`${label}: واژه‌ی «لیسانس» ممنوع است`);
  const opens = (s.match(/\{\{/g) ?? []).length;
  const closes = (s.match(/\}\}/g) ?? []).length;
  if (opens !== closes) out.push(`${label}: تعداد {{ و }} برابر نیست`);
  if (/\}\}\}/.test(s)) out.push(`${label}: «}}}» دارد؛ فرمول داخل {{…}} نباید با گروه {…} تمام شود (Fe^3+ بنویسید نه Fe^{3+})`);
  if ((s.match(/\[\[/g) ?? []).length !== (s.match(/\]\]/g) ?? []).length) out.push(`${label}: تعداد [[ و ]] برابر نیست`);
  if ((s.match(/\*\*/g) ?? []).length % 2) out.push(`${label}: ** باز و بسته نشده است`);
  const p = prose(s);
  if (/[A-Z][a-z]?\d/.test(p)) out.push(`${label}: فرمول خام بیرون از {{…}} دارد`);
  if (/\d/.test(p)) out.push(`${label}: رقم لاتین در نثر دارد (رقم فارسی بنویسید یا داخل {{…}}/[[…]] بگذارید)`);
  if (/->|<=>|→|⇌/.test(p)) out.push(`${label}: پیکان واکنش بیرون از {{…}} دارد`);
  if (/(^|[\s«(])ن?می [آ-ی]/.test(p)) out.push(`${label}: «می» بدون نیم‌فاصله (مثل «می شود»)`);
  if (/\s[.،؛:؟]/.test(stripMarkup(s))) out.push(`${label}: فاصله‌ی پیش از نشانه‌ی سجاوندی`);
  return out;
}

/** کنترل یک آزمون؛ stub (بدون سؤال) فقط از نظر شناسه بررسی می‌شود */
export function validateQuiz(q: QuizContent): QuizReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tag = `${q.grade}-F${q.n}`;
  const chapter = GRADE_PAGES[q.grade]?.chapters[q.n - 1];
  if (!chapter || q.n < 1 || q.n > chapterCount(q.grade)) {
    errors.push(`${tag}: فصل در syllabus.ts وجود ندارد`);
    return { errors, warnings };
  }
  if (!q.questions.length) return { errors, warnings };

  // صفحه
  const title = quizTitle(q);
  if ([...title].length > 60) errors.push(`${tag}: عنوان بیش از ۶۰ نویسه است (${faNum([...title].length)})`);
  const dl = [...stripMarkup(q.description)].length;
  if (dl < 100 || dl > 170) errors.push(`${tag}: طول توضیح متا ${faNum(dl)} است (باید ۱۰۰ تا ۱۷۰ باشد)`);
  if (/\{\{|\[\[|\*\*/.test(q.description)) errors.push(`${tag}: توضیح متا نباید نشانه‌گذاری داشته باشد (فرمول را یونیکد بنویسید: SO₄²⁻)`);
  const iw = q.intro.reduce((a, p) => a + wordCount(p), 0);
  if (iw < 100 || iw > 150) errors.push(`${tag}: مقدمه ${faNum(iw)} واژه است (باید ۱۰۰ تا ۱۵۰ باشد)`);
  errors.push(...textProblems(`${tag} توضیح متا`, q.description));
  q.intro.forEach((p, i) => errors.push(...textProblems(`${tag} مقدمه‌ی ${faNum(i + 1)}`, p)));
  if (q.teacherNote) errors.push(...textProblems(`${tag} نکته استاد`, q.teacherNote));

  // سؤال‌ها
  const n = q.questions.length;
  if (n < MIN_QUESTIONS || n > MAX_QUESTIONS) errors.push(`${tag}: ${faNum(n)} سؤال دارد (باید ${faNum(MIN_QUESTIONS)} تا ${faNum(MAX_QUESTIONS)} باشد)`);
  const prefix = `g${q.grade.slice(1)}-f${q.n}-q`;
  const ids = new Set<string>();
  const texts = new Set<string>();
  const letters = [0, 0, 0, 0];
  const covered = new Set<string>();
  let calc = 0;
  q.questions.forEach((x, i) => {
    const qt = `${tag} سؤال ${faNum(i + 1)} (${x.id})`;
    if (!/^g1[0-2]-f[1-4]-q\d{2}$/.test(x.id) || !x.id.startsWith(prefix)) errors.push(`${qt}: شناسه باید «${prefix}NN» باشد`);
    if (ids.has(x.id)) errors.push(`${qt}: شناسه‌ی تکراری`);
    ids.add(x.id);
    const norm = stripMarkup(x.text).replace(/\s+/g, " ").trim();
    if (texts.has(norm)) errors.push(`${qt}: صورت سؤال تکراری`);
    texts.add(norm);
    if (x.options.length !== 4) errors.push(`${qt}: باید دقیقاً ۴ گزینه داشته باشد`);
    if (new Set(x.options.map((o) => o.trim())).size !== x.options.length) errors.push(`${qt}: گزینه‌ی تکراری`);
    if (x.options.some((o) => !o.trim())) errors.push(`${qt}: گزینه‌ی خالی`);
    if (!Number.isInteger(x.correct) || x.correct < 0 || x.correct > 3) errors.push(`${qt}: correct باید ۰ تا ۳ باشد`);
    else letters[x.correct]++;
    if (!chapter.topics.includes(x.subtopic)) errors.push(`${qt}: زیرفصل «${x.subtopic}» در topics این فصل نیست`);
    covered.add(x.subtopic);
    if (!LEVELS.has(x.level)) errors.push(`${qt}: سطح نامعتبر`);
    if (x.calc) calc++;
    const sc = sentenceCount(x.explanation);
    if (sc < 2 || sc > 4) errors.push(`${qt}: پاسخ تشریحی ${faNum(sc)} جمله است (باید ۲ تا ۴ باشد)`);
    if (/گزینه‌ی?\s*[۱-۴1-4]/.test(x.explanation)) warnings.push(`${qt}: پاسخ تشریحی به شماره‌ی گزینه ارجاع داده است`);
    errors.push(...textProblems(`${qt} صورت`, x.text));
    if (x.given) errors.push(...textProblems(`${qt} داده‌ها`, x.given));
    x.options.forEach((o, j) => errors.push(...textProblems(`${qt} گزینه‌ی ${faNum(j + 1)}`, o)));
    errors.push(...textProblems(`${qt} پاسخ`, x.explanation));
  });
  for (const t of chapter.topics) if (!covered.has(t)) errors.push(`${tag}: زیرفصل «${t}» هیچ سؤالی ندارد`);
  letters.forEach((c, i) => {
    if (c / n > MAX_LETTER_SHARE) errors.push(`${tag}: گزینه‌ی ${faNum(i + 1)} پاسخ ${faNum(c)} سؤال از ${faNum(n)} است (بیش از ۴۰٪)`);
  });
  if (calc < MIN_CALC) warnings.push(`${tag}: فقط ${faNum(calc)} سؤال محاسباتی دارد (برای فصل محاسباتی دست‌کم ${faNum(MIN_CALC)})`);
  return { errors, warnings };
}

/** کنترل همه‌ی آزمون‌ها با هم: علاوه بر هر آزمون، شناسه و صورت سؤال تکراری بین آزمون‌ها */
export function validateAll(list: readonly QuizContent[]): QuizReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, string>();
  const texts = new Map<string, string>();
  for (const q of list) {
    const r = validateQuiz(q);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    for (const x of q.questions) {
      const where = `${q.grade}-F${q.n}`;
      const prevId = ids.get(x.id);
      if (prevId && prevId !== where) errors.push(`${x.id}: شناسه در ${prevId} و ${where} تکرار شده است`);
      ids.set(x.id, where);
      const norm = stripMarkup(x.text).replace(/\s+/g, " ").trim();
      const prevText = texts.get(norm);
      if (prevText && prevText !== where) errors.push(`${x.id}: همین صورت سؤال در ${prevText} هم آمده است`);
      texts.set(norm, where);
    }
  }
  return { errors, warnings };
}
