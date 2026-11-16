/** کنترل داده‌ی آزمون‌ها (اجرا: node --import tsx --test src/content/quizzes/*.test.ts src/components/quiz/*.test.ts) */
import test from "node:test";
import assert from "node:assert/strict";
import { GRADE_KEYS, chapterCount, chapterTitle, quizParams } from "../../lib/site-routes";
import { QUIZZES, getQuiz, isQuizReady, nextQuiz, quizHeading, quizSlug, quizTitle, readyQuizParams } from "./index";
import { sentenceCount, stripMarkup, validateAll, validateQuiz, wordCount } from "./validate";

test("برای هر فصل دقیقاً یک آزمون ثبت شده است", () => {
  const keys = QUIZZES.map((q) => `${q.grade}-${q.n}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const g of GRADE_KEYS) for (let n = 1; n <= chapterCount(g); n++) assert.ok(getQuiz(g, n), `${g}-${n}`);
  assert.equal(QUIZZES.length, quizParams().length);
});

test("همه‌ی آزمون‌ها از کنترل قالب و کیفیت می‌گذرند", () => {
  const r = validateAll(QUIZZES);
  assert.deepEqual(r.errors, []);
});

test("آزمون نمونه‌ی فصل اول دهم: معیارهای پوشش، محاسبه و توزیع پاسخ", () => {
  const q = getQuiz("G10", 1)!;
  assert.ok(isQuizReady(q));
  const r = validateQuiz(q);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.ok(q.questions.length >= 12 && q.questions.length <= 15);
  assert.ok(q.questions.filter((x) => x.calc).length >= 4, "دست‌کم ۴ سؤال محاسباتی");
  const letters = [0, 0, 0, 0];
  q.questions.forEach((x) => letters[x.correct]++);
  assert.ok(Math.max(...letters) / q.questions.length <= 0.4, `توزیع پاسخ‌ها: ${letters}`);
  const iw = q.intro.reduce((a, p) => a + wordCount(p), 0);
  assert.ok(iw >= 100 && iw <= 150, `مقدمه: ${iw} واژه`);
  assert.ok([...quizTitle(q)].length <= 60);
  assert.equal(quizTitle(q), "آزمون آنلاین شیمی دهم فصل اول (تست با پاسخ تشریحی)");
  assert.equal(quizHeading("G10", 1), `آزمون آنلاین فصل اول شیمی دهم: ${chapterTitle("G10", 1)}`);
});

test("فقط آزمون‌های آماده ساخته می‌شوند و عنوان همه‌ی فصل‌ها کوتاه است", () => {
  const ready = readyQuizParams().map((p) => p.slug);
  assert.ok(ready.includes("dahom-fasl-1"));
  for (const q of QUIZZES) {
    assert.equal(ready.includes(quizSlug(q.grade, q.n)), isQuizReady(q));
    assert.ok([...quizTitle(q)].length <= 60, quizTitle(q));
  }
});

test("آزمون بعدی", () => {
  assert.deepEqual(nextQuiz("G10", 1), { g: "G10", n: 2 });
  assert.deepEqual(nextQuiz("G10", 3), { g: "G11", n: 1 });
  assert.deepEqual(nextQuiz("G12", 3), { g: "G12", n: 4 });
  assert.equal(nextQuiz("G12", 4), null);
});

test("کنترل‌گر خطاهای رایج را می‌گیرد", () => {
  const base = getQuiz("G10", 1)!;
  const bad = {
    ...base,
    questions: base.questions.map((x, i) =>
      i === 0 ? { ...x, text: "اسید H2SO4 در آب يونش دارد؛ 3 مول؟", correct: 0 as const } : i < 8 ? { ...x, correct: 0 as const } : x,
    ),
  };
  const errs = validateQuiz(bad).errors.join("\n");
  assert.match(errs, /فرمول خام/);
  assert.match(errs, /عربی/);
  assert.match(errs, /رقم لاتین/);
  assert.match(errs, /بیش از ۴۰٪/);
  assert.match(validateQuiz({ ...base, questions: base.questions.slice(0, 11) }).errors.join("\n"), /۱۱ سؤال/);
  const dupAcross = validateAll([base, { ...base, n: 2, questions: base.questions.map((x) => ({ ...x, id: x.id.replace("f1", "f2") })) }]);
  assert.ok(dupAcross.errors.some((e) => e.includes("همین صورت سؤال")));
  assert.match(validateQuiz({ ...base, description: "کوتاه" }).errors.join("\n"), /توضیح متا/);
  assert.equal(sentenceCount("جمله‌ی اول با عدد ۰٫۵ است. جمله‌ی دوم؟ سوم!"), 3);
  assert.equal(stripMarkup("**الف** {{H2O}} [[۲ + ۲]]"), "الف F M");
});
