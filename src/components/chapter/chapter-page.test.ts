/**
 * آزمون رندر بدنه‌ی صفحه‌ی فصل و متن صفحه‌های پایه
 * (اجرا: node --import tsx --test src/components/chapter/chapter-page.test.ts).
 * همان قاعده‌های seo-check را روی HTML ایستا می‌سنجد: فرمول خام بیرون از .chem، «ی/ک» عربی، شمار کلمه.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChapterBody } from "./ChapterBody";
import { readyChapters } from "../../content/chapters";
import { GRADE_CONTENT } from "../../content/chapters/grades";
import { GRADE_KEYS, chapterLabel } from "../../lib/site-routes";

const RAW_FORMULA = /(?<![A-Za-z0-9_/.:#=-])[A-Z][a-z]?\d/;
const RAW_ARROW = /(->|<=>|=>)/;
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const dropChem = (html: string) => html.replace(/<bdi\b[^>]*class="[^"]*\bchem\b[^"]*"[^>]*>[\s\S]*?<\/bdi>/gi, " ");
const countWords = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

for (const c of readyChapters()) {
  test(`رندر بدنه‌ی ${c.grade} فصل ${c.n}`, () => {
    const html = renderToStaticMarkup(h(ChapterBody, { c, label: chapterLabel(c.grade, c.n) }));
    const visible = text(html);
    const words = countWords(visible);
    assert.ok(words >= 1500, `متن دیدنی ${words} کلمه است`);
    assert.ok((html.match(/class="chem[ "]/g) || []).length >= 4, "کمتر از ۴ فرمول با Chem");
    assert.ok(!/[يك]/.test(visible), "«ی/ک» عربی");
    const noChem = text(dropChem(html));
    assert.ok(!RAW_FORMULA.test(noChem), `فرمول خام: ${RAW_FORMULA.exec(noChem)?.[0]}`);
    assert.ok(!RAW_ARROW.test(noChem), "پیکان خام");
    assert.ok(!/[{}^_]/.test(noChem), `نشانه‌گذاری خام بیرون از فرمول: «${/.{0,20}[{}^_].{0,20}/.exec(noChem)?.[0]}»`);
    // هر سؤال و پاسخ در HTML سرور هست و پاسخ‌نامه پس از آخرین سؤال می‌آید
    const plainHtml = text(html);
    for (const q of c.sampleQuestions) {
      const qLead = q.q.split("{{")[0].replace(/\*\*/g, "").trim().split(/\s+/).slice(0, 4).join(" ");
      if (qLead) assert.ok(plainHtml.includes(qLead), `سؤال در HTML نیست: ${qLead}`);
      // آغاز متنی هر پاسخ (پیش از نخستین فرمول) باید در HTML باشد
      for (const a of Array.isArray(q.answer) ? q.answer : [q.answer]) {
        const lead = a.split("{{")[0].replace(/\*\*/g, "").trim().split(/\s+/).slice(0, 4).join(" ");
        if (lead) assert.ok(plainHtml.includes(lead), `پاسخ در HTML نیست: ${lead}`);
      }
    }
    const lastQ = html.lastIndexOf(`id="nemoone-soal-q${c.sampleQuestions.length}"`);
    const firstA = html.indexOf('id="nemoone-soal-a1"');
    assert.ok(lastQ > 0 && firstA > lastQ, "پاسخ‌نامه باید پس از همه‌ی سؤال‌ها بیاید");
    assert.equal((html.match(/<details/g) || []).length, c.sampleQuestions.length);
    // «نکته استاد» تا وقتی متن استاد نیست نمایش داده نمی‌شود
    if (!c.teacherNotes.length) assert.ok(!html.includes("نکته استاد"));
  });
}

test("صفحه‌های پایه: عنوان، توضیح و پرسش‌های یکتا", () => {
  const answers = new Map<string, string>();
  for (const g of GRADE_KEYS) {
    const gc = GRADE_CONTENT[g];
    assert.ok([...gc.title].length <= 60, `${g}: عنوان ${[...gc.title].length} نویسه`);
    const desc = `${gc.description} با استاد جواد پرتویی.`;
    assert.ok([...desc].length >= 100 && [...desc].length <= 170, `${g}: توضیح ${[...desc].length} نویسه`);
    assert.ok(gc.faqs.length >= 4, `${g}: کمتر از ۴ پرسش`);
    const introWords = gc.intro.reduce((n, p) => n + countWords(p.replace(/\{\{|\}\}|\*\*/g, "")), 0);
    assert.ok(introWords >= 120 && introWords <= 180, `${g}: مقدمه ${introWords} کلمه (۱۲۰ تا ۱۸۰)`);
    const all = [...gc.intro, ...gc.prereq, gc.planNote, ...gc.plan.map((p) => p.text), ...gc.challenges.map((c) => c.text), ...gc.faqs.map((f) => f.a)];
    for (const t of all) {
      const out = t.replace(/\{\{[\s\S]*?\}\}/g, " ");
      assert.ok(!RAW_FORMULA.test(out), `${g}: فرمول خام در «${t.slice(0, 40)}»`);
      assert.ok(!/[يك]/.test(t), `${g}: «ی/ک» عربی`);
      assert.ok(!/[0-9]/.test(out), `${g}: رقم لاتین در «${t.slice(0, 40)}»`);
    }
    for (const f of gc.faqs) {
      assert.ok(!answers.has(f.a), `پاسخ تکراری میان ${answers.get(f.a)} و ${g}`);
      answers.set(f.a, g);
    }
  }
  assert.equal(new Set(GRADE_KEYS.map((g) => GRADE_CONTENT[g].title)).size, 3);
});
