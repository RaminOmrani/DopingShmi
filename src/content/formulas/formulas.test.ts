/**
 * آزمون برگه‌ی فرمول‌ها (اجرا: node --import tsx --test src/content/formulas/formulas.test.ts).
 * همان قاعده‌های seo-check را روی HTML ایستای بدنه‌ی صفحه می‌سنجد: فرمول خام بیرون از .chem، «ی/ک» عربی،
 * شمار کلمه، پوشش هر ۱۰ فصل و طول عنوان و توضیح.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormulaSheet } from "../../app/(site)/formul-shimi/FormulaSheet";
import { FORMULA_PAGE, FORMULA_SHEET, allFormulas } from "./index";
import { chemPlain, splitChemText } from "../../components/seo/chem-format";
import { GRADE_KEYS, chapterCount } from "../../lib/site-routes";

const RAW_FORMULA = /(?<![A-Za-z0-9_/.:#=-])[A-Z][a-z]?\d/;
const RAW_ARROW = /(->|<=>|=>)/;
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const dropChem = (html: string) => html.replace(/<bdi\b[^>]*class="[^"]*\bchem\b[^"]*"[^>]*>[\s\S]*?<\/bdi>/gi, " ");
const countWords = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** همه‌ی رشته‌های Rich داده (برای بررسی نشانه‌گذاری) */
function richStrings(): string[] {
  const out: string[] = [...FORMULA_PAGE.intro, ...FORMULA_PAGE.tips];
  for (const g of FORMULA_SHEET) {
    out.push(g.lead);
    for (const c of g.chapters)
      for (const it of c.items) {
        out.push(it.name, it.when, it.example, ...(it.note ? [it.note] : []), ...(it.words ? [it.words] : []));
        for (const v of it.vars) out.push(v.sym, v.desc);
        if (it.table) out.push(...it.table.head, ...it.table.rows.flat());
      }
  }
  return out;
}

const html = renderToStaticMarkup(h(FormulaSheet));
const visible = text(html);

test("هر ۱۰ فصل پوشش داده شده و شناسه‌ها یکتاست", () => {
  for (const g of GRADE_KEYS) {
    const gr = FORMULA_SHEET.find((x) => x.grade === g);
    assert.ok(gr, `پایه‌ی ${g} نیست`);
    assert.deepEqual(gr.chapters.map((c) => c.n), Array.from({ length: chapterCount(g) }, (_, i) => i + 1), `${g}: فصل‌ها کامل نیست`);
    for (const c of gr.chapters) assert.equal(c.grade, g);
  }
  const ids = allFormulas().map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, "شناسه‌ی تکراری");
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});

test("هر رابطه شکل نمادین یا کلامی، کاربرد و مثال دارد", () => {
  for (const it of allFormulas()) {
    assert.ok(it.f || it.words || it.table, `${it.id}: رابطه ندارد`);
    assert.ok(it.when.trim() && it.example.trim(), `${it.id}: کاربرد یا مثال خالی`);
    assert.match(html, new RegExp(`id="${it.id}"`));
  }
});

test("عنوان و توضیح متا", () => {
  const t = [...FORMULA_PAGE.title].length;
  const d = [...FORMULA_PAGE.description].length;
  assert.ok(t <= 60, `عنوان ${t} نویسه`);
  assert.ok(d >= 120 && d <= 160, `توضیح ${d} نویسه`);
});

test("نشانه‌گذاری ChemText سالم است", () => {
  for (const s of richStrings()) {
    assert.ok(!s.includes("}}}"), `«}}}» در: ${s}`);
    assert.ok(!/[\u064A\u0643]/.test(s), `«ی/ک» عربی در: ${s}`);
    assert.ok(!s.includes("\u0644\u06CC\u0633\u0627\u0646\u0633"), "مدرک نادرست");
    for (const seg of splitChemText(s).flatMap((x) => (x.t === "bold" ? x.children : [x]))) {
      if (seg.t === "chem" || seg.t === "eq") {
        const plain = chemPlain(seg.v);
        if (seg.t === "chem") assert.ok([...plain].length <= 32, `فرمول بلند (${[...plain].length}): ${plain}`);
        // بار ناخواسته پس از پرانتز یا عدد (مثل «(…)⁻ » در تفریق)
        assert.ok(!/\)[⁺⁻] /.test(plain), `بار ناخواسته در: ${plain}`);
      }
      if (seg.t === "text") assert.ok(!/\d/.test(seg.v.replace(/[۰-۹٫]/g, "")), `رقم لاتین بیرون از فرمول: «${seg.v}»`);
    }
  }
});

test("HTML بدنه: بدون فرمول خام، با Chem کافی و شمار کلمه‌ی مناسب", () => {
  assert.ok(!/[\u064A\u0643]/.test(visible), "«ی/ک» عربی");
  const noChem = text(dropChem(html));
  assert.ok(!RAW_FORMULA.test(noChem), `فرمول خام: ${RAW_FORMULA.exec(noChem)?.[0]}`);
  assert.ok(!RAW_ARROW.test(noChem), "پیکان خام");
  assert.ok(!/[{}^_]/.test(noChem), `نشانه‌گذاری خام: «${/.{0,20}[{}^_].{0,20}/.exec(noChem)?.[0]}»`);
  const chems = (html.match(/class="chem[ "]/g) || []).length;
  assert.ok(chems >= allFormulas().length, `فقط ${chems} فرمول با Chem`);
  // کلمه‌های متن (بدون نمادها و عددهای داخل فرمول‌ها)؛ مسیر راهنما، امضا، لینک‌های مرتبط و دعوت به کلاس
  // حدود ۸۰ کلمه به <main> اضافه می‌کنند. seo-check همه‌ی تکه‌های فرمول را هم کلمه می‌شمارد (حدود ۶۰۰ بیشتر).
  // وقتی ابزارها و فصل‌ها live می‌شوند، لینک «مرور/ابزار» هر کارت حدود ۲۵۰ کلمه‌ی دیگر اضافه می‌کند.
  const words = countWords(noChem);
  assert.ok(words >= 1150 && words <= 2050, `متن بدنه ${words} کلمه است`);
});

test("«نکته استاد» تا متن استاد نرسیده نمایش داده نمی‌شود", () => {
  assert.ok(!html.includes("نکته استاد"));
});
