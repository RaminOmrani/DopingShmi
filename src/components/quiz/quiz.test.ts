/** آزمون نمره‌دهی، ذخیره‌ی محلی و HTML سروری آزمون (اجرا: node --import tsx --test src/components/quiz/*.test.ts) */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fmtPercent, loadScore, quizStorageKey, resultOf, saveScore, scoreQuiz } from "./score";
import { QuizAnswerKey, QuizQuestions } from "./QuizQuestions";
import { QuizText } from "./QuizText";
import { getQuiz } from "../../content/quizzes";

test("نمره: همه درست، همه نادرست، بی‌پاسخ و ترکیبی", () => {
  const keys = [0, 1, 2, 3, 0, 1];
  const all = scoreQuiz(keys, keys);
  assert.deepEqual([all.correct, all.wrong, all.blank], [6, 0, 0]);
  assert.equal(all.percent, 100);
  assert.equal(all.percentNeg, 100);

  const wrong = scoreQuiz(keys, keys.map((k) => (k + 1) % 4));
  assert.deepEqual([wrong.correct, wrong.wrong, wrong.blank], [0, 6, 0]);
  assert.equal(wrong.percent, 0);
  assert.ok(Math.abs(wrong.percentNeg - -100 / 3) < 1e-9);
  assert.equal(fmtPercent(wrong.percentNeg), "‎−۳۳٫۳٪");

  const blank = scoreQuiz(keys, [null, null, undefined, null, null, null]);
  assert.deepEqual([blank.correct, blank.wrong, blank.blank], [0, 0, 6]);
  assert.equal(blank.percentNeg, 0);
  assert.equal(fmtPercent(blank.percentNeg), "۰٪");

  // ۹ درست، ۳ نادرست، ۳ بی‌پاسخ از ۱۵ → ۶۰٪ و (۲۷ − ۳) ÷ ۴۵ = ۵۳٫۳٪
  const k15 = Array.from({ length: 15 }, (_, i) => i % 4);
  const p15 = k15.map((k, i) => (i < 9 ? k : i < 12 ? (k + 1) % 4 : null));
  const mix = scoreQuiz(k15, p15);
  assert.deepEqual([mix.correct, mix.wrong, mix.blank], [9, 3, 3]);
  assert.equal(fmtPercent(mix.percent), "۶۰٪");
  assert.equal(fmtPercent(mix.percentNeg), "۵۳٫۳٪");
  assert.equal(resultOf(2, null), "blank");
  assert.equal(resultOf(2, 2), "correct");
  assert.equal(resultOf(2, 0), "wrong");
  assert.equal(scoreQuiz([], []).percent, 0);
});

test("ذخیره‌ی محلی: خطای localStorage هیچ‌وقت به بیرون پرتاب نمی‌شود", () => {
  const key = quizStorageKey("dahom-fasl-1");
  assert.equal(key, "ds-quiz:dahom-fasl-1");
  const throwing = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  const s = scoreQuiz([0, 1], [0, null]);
  assert.equal(loadScore(key, throwing), null);
  assert.equal(saveScore(key, s, throwing), false);
  assert.equal(loadScore(key, null), null);
  assert.equal(saveScore(key, s, null), false);
  // در Node، localStorage سراسری وجود ندارد یا خطا می‌دهد؛ باز هم بدون پرتاب
  assert.doesNotThrow(() => loadScore(key));
  assert.doesNotThrow(() => saveScore(key, s));

  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert.equal(saveScore(key, s, store, 1700000000000), true);
  assert.deepEqual(loadScore(key, store), { total: 2, correct: 1, wrong: 0, blank: 1, percent: 50, percentNeg: 50, at: 1700000000000 });
  mem.set(key, "{خراب");
  assert.equal(loadScore(key, store), null);
  mem.set(key, JSON.stringify({ percent: "x" }));
  assert.equal(loadScore(key, store), null);
});

test("QuizText: محاسبه چپ‌به‌راست با رقم فارسی و فرمول با Chem", () => {
  const out = renderToStaticMarkup(h(QuizText, { text: "جرم {{H2O}} برابر [[2 × 1 + 16 = 18]] و [[۶٫۰۲ × ۱۰^۲۳]] و [[10^-3]] است" }));
  assert.match(out, /<bdi dir="ltr" translate="no" class="chem whitespace-nowrap">H<sub>2<\/sub>O<\/bdi>/);
  assert.match(out, /<bdi dir="ltr" class="math">۲ × ۱ \+ ۱۶ = ۱۸<\/bdi>/);
  assert.match(out, /<bdi dir="ltr" class="math">۶٫۰۲ × ۱۰<sup>۲۳<\/sup><\/bdi>/);
  assert.match(out, /۱۰<sup>−۳<\/sup>/);
  assert.ok(!/[0-9]/.test(out.replace(/<[^>]+>/g, "").replace(/H2O|H|O/g, "")), "رقم لاتین بیرون از فرمول نماند");
});

test("HTML سروری آزمون: همه‌ی سؤال‌ها، گزینه‌ها و پاسخ‌ها بدون جاوااسکریپت", () => {
  const quiz = getQuiz("G10", 1)!;
  const html = renderToStaticMarkup(h(QuizQuestions, { quiz }));
  const n = quiz.questions.length;
  assert.equal((html.match(/<fieldset/g) ?? []).length, n);
  assert.equal((html.match(/<legend/g) ?? []).length, n);
  assert.equal((html.match(/type="radio"/g) ?? []).length, n * 4);
  assert.equal((html.match(/<details/g) ?? []).length, n);
  assert.equal((html.match(/data-correct=""/g) ?? []).length, n);
  assert.equal((html.match(/پاسخ و توضیح/g) ?? []).length, n);
  quiz.questions.forEach((q, i) => {
    assert.ok(html.includes(`name="${q.id}"`), q.id);
    assert.ok(html.includes(`data-q="${i}"`));
    // گزینه‌ی درستِ داده همان است که data-correct دارد
    const fs = html.split("<fieldset").slice(1)[i];
    const labels = fs.split("<label").slice(1);
    assert.equal(labels.findIndex((l) => l.includes("data-correct")), q.correct, q.id);
  });
  assert.ok(!/[يك]/.test(html), "ی/ک عربی");
  assert.ok(!html.includes("لیسانس"));
  const key = renderToStaticMarkup(h(QuizAnswerKey, { quiz }));
  assert.match(key, /print:block/);
  assert.equal((key.match(/سؤال /g) ?? []).length, n);
});
