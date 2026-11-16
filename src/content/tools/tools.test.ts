/**
 * آزمون محتوا و رندر صفحه‌های ابزار (بسته‌ی C2)
 * اجرا: node --import tsx --test src/content/tools/tools.test.ts
 *
 * - قاعده‌های متن: طول عنوان و توضیح، «ی/ک» فارسی، نبود «لیسانس»، فرمول خام بیرون از {{}}، رقم لاتین در نثر، طول {{…}}
 * - هر عدد مثال‌ها با خروجی کتابخانه‌ی شیمی (src/lib/chem) برابر است
 * - داده‌ی جدول تناوبی: ۷۹ نام اول برابر constants.ts، و جمله‌های راهنما (مایع‌ها، گازها، شبه‌فلزها) با داده می‌خواند
 * - جزیره‌های ابزار در HTML سرور نتیجه‌ی نمونه‌ی پیش‌فرض را دارند و فرمول خام بیرون از .chem ندارند
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ELEMENTS as LEVEL_ELEMENTS } from "../../lib/constants";
import { balanceEquation } from "../../lib/chem/balance";
import { ELEMENTS, elementBySymbol, fullConfig } from "../../lib/chem/elements";
import { averageAtomicMass, molarMass } from "../../lib/chem/molar-mass";
import { convertPh, strongAcid, strongBase, weakAcid } from "../../lib/chem/ph";
import { BalanceTool } from "../../components/tools/BalanceTool";
import { ElementList } from "../../components/tools/ElementList";
import { MolarMassTool } from "../../components/tools/MolarMassTool";
import { AverageMassTool } from "../../components/tools/AverageMassTool";
import { PeriodicTable } from "../../components/tools/PeriodicTable";
import { PhTool } from "../../components/tools/PhTool";
import { ToolGuide } from "../../components/tools/ToolGuide";
import { neighbor, searchElements } from "../../components/tools/pt-data";
import { BALANCE, BALANCE_DEFAULT, BALANCE_EXAMPLES } from "./balance";
import { COMPOUNDS, MOLAR_MASS, MOLAR_MASS_DEFAULT, MOLAR_MASS_EXAMPLES } from "./molar-mass";
import { PERIODIC } from "./periodic";
import { PH } from "./ph";
import type { Rich, ToolContent } from "./types";

const ALL: ToolContent[] = [MOLAR_MASS, BALANCE, PH, PERIODIC];
/** بازه‌ی کلمه‌های راهنما طبق برنامه‌ی سئو */
const WORDS: Record<string, [number, number]> = { molarMass: [800, 1200], balance: [1000, 1500], ph: [800, 1200], periodic: [800, 1200] };

const plain = (s: string) => s.replace(/\{\{([\s\S]*?)\}\}/g, " $1 ").replace(/\*\*|`/g, " ");
const countWords = (s: string) => plain(s).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
/** متن بیرون از {{…}} و `…` */
const prose = (s: string) => s.replace(/\{\{[\s\S]*?\}\}/g, " ").replace(/`[^`]*`/g, " ");

function strings(c: ToolContent): { where: string; text: Rich }[] {
  const out: { where: string; text: Rich }[] = [
    { where: "lead", text: c.lead },
    ...c.howTo.map((t, i) => ({ where: `howTo[${i}]`, text: t })),
  ];
  for (const s of c.sections) {
    const w = `sections.${s.id}`;
    out.push({ where: `${w}.heading`, text: s.heading });
    s.paragraphs.forEach((t, i) => out.push({ where: `${w}.paragraphs[${i}]`, text: t }));
    s.bullets?.forEach((t, i) => out.push({ where: `${w}.bullets[${i}]`, text: t }));
    s.ordered?.forEach((t, i) => out.push({ where: `${w}.ordered[${i}]`, text: t }));
    if (s.tip) out.push({ where: `${w}.tip`, text: s.tip });
    if (s.mistake) out.push({ where: `${w}.mistake`, text: s.mistake });
    s.examples?.forEach((e, i) => {
      out.push({ where: `${w}.examples[${i}].question`, text: e.question }, { where: `${w}.examples[${i}].answer`, text: e.answer });
      e.steps.forEach((t, j) => out.push({ where: `${w}.examples[${i}].steps[${j}]`, text: t }));
    });
  }
  return out;
}

const guideWords = (c: ToolContent) => strings(c).filter((s) => s.where.startsWith("sections.")).reduce((a, s) => a + countWords(s.text), 0);

for (const c of ALL) {
  test(`متن ${c.key}: متا، املا و نشانه‌گذاری`, () => {
    assert.ok([...c.title].length <= 60, `عنوان ${[...c.title].length} نویسه است`);
    const d = [...c.description].length;
    assert.ok(d >= 100 && d <= 170, `توضیح ${d} نویسه است`);
    assert.ok(!/[{}*`]/.test(c.title + c.description), "نشانه‌گذاری در عنوان یا توضیح");
    assert.deepEqual(c.teacherNotes, [], "«نکته استاد» فقط با متن خود استاد");
    const ids = c.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "شناسه‌ی تکراری بخش");
    for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
    for (const { where, text } of [...strings(c), { where: "title", text: c.title }, { where: "description", text: c.description }, { where: "h1", text: c.h1 }]) {
      assert.ok(!/[يكۀ]/.test(text), `${where}: «ی/ک» عربی`);
      assert.ok(!/لیسانس/.test(text), `${where}: «لیسانس»`);
      assert.ok(!/\}\}\}/.test(text), `${where}: «}}}» (فرمول نباید با } تمام شود)`);
      assert.equal((text.match(/\{\{/g) || []).length, (text.match(/\}\}/g) || []).length, `${where}: {{ و }} نابرابر`);
      assert.equal((text.match(/`/g) || []).length % 2, 0, `${where}: \` نابرابر`);
      const p = prose(text);
      assert.ok(!/(?<![A-Za-z0-9_/.:#=-])[A-Z][a-z]?\d/.test(p), `${where}: فرمول خام بیرون از {{}}: ${/.{0,15}[A-Z][a-z]?\d.{0,15}/.exec(p)?.[0]}`);
      assert.ok(!/(->|<=>|=>)/.test(p), `${where}: پیکان خام`);
      assert.ok(!/[0-9]/.test(p), `${where}: رقم لاتین در نثر: ${/.{0,15}[0-9].{0,15}/.exec(p)?.[0]}`);
      assert.ok(!/[\^_]/.test(p.replace(/\*\*/g, "")), `${where}: ^ یا _ بیرون از فرمول`);
      for (const m of text.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
        const f = m[1];
        if (!/(->|<=>)/.test(f)) assert.ok([...f].length <= 32, `${where}: {{${f}}} بیش از ۳۲ نویسه است (در گوشی نمی‌شکند)`);
      }
    }
  });

  test(`متن ${c.key}: شمار کلمه‌های راهنما`, () => {
    const n = guideWords(c);
    const [lo, hi] = WORDS[c.key];
    assert.ok(n >= lo && n <= hi, `راهنما ${n} کلمه است (بازه‌ی ${lo} تا ${hi})`);
  });

  test(`رندر راهنمای ${c.key}`, () => {
    const html = renderToStaticMarkup(h(ToolGuide, { sections: c.sections }));
    assert.equal((html.match(/<h2\b/g) || []).length, c.sections.length);
    const noChem = html.replace(/<bdi\b[^>]*class="[^"]*\bchem\b[^"]*"[^>]*>[\s\S]*?<\/bdi>/gi, " ").replace(/<[^>]+>/g, " ");
    assert.ok(!/(?<![A-Za-z0-9_/.:#=-])[A-Z][a-z]?\d/.test(noChem), "فرمول خام در HTML راهنما");
    assert.ok(!/[{}]/.test(noChem), "{ یا } خام در HTML راهنما");
  });
}

test("مثال‌های موازنه با خروجی balanceEquation یکی است", () => {
  let n = 0;
  for (const s of BALANCE.sections)
    for (const e of s.examples ?? []) {
      assert.ok(e.check, `مثال «${e.title}» check ندارد`);
      const r = balanceEquation(e.check.equation);
      assert.ok(r.ok, `${e.check.equation}: ${!r.ok && r.error}`);
      assert.deepEqual(r.coefficients, e.check.coefficients, e.title);
      // پاسخ نوشته‌شده همان معادله‌ی کتابخانه است
      assert.ok(e.answer.includes(r.equation), `پاسخ «${e.title}» با ${r.equation} نمی‌خواند`);
      n++;
    }
  assert.ok(n >= 4 && n <= 5, `${n} مثال روش وارسی`);
  // معادله‌ی یونی بخش ۴ و روش جبری
  const ionic = balanceEquation("MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O");
  assert.ok(ionic.ok);
  assert.deepEqual(ionic.coefficients, [1, 5, 8, 1, 5, 4]);
  const ionicLine = BALANCE.sections.find((s) => s.id === "vakonesh-yoni")!.equations![0];
  assert.equal(ionicLine, ionic.equation);
  const propane = balanceEquation("C3H8 + O2 -> CO2 + H2O");
  assert.ok(propane.ok);
  assert.deepEqual(propane.coefficients, [1, 5, 3, 4]);
  for (const eq of [...BALANCE_EXAMPLES, BALANCE_DEFAULT]) assert.ok(balanceEquation(eq).ok, eq);
});

test("عددهای مثال‌های جرم مولی با molar-mass.ts یکی است", () => {
  const v = (f: string, mode: "precise" | "exam" = "exam") => {
    const r = molarMass(f, { mode });
    assert.ok(r.ok, f);
    return r.ok ? r.value : NaN;
  };
  assert.equal(v("Al2(SO4)3"), 342);
  assert.equal(v("Al2(SO4)3", "precise"), 342.13);
  assert.equal(v("H2SO4"), 98);
  assert.equal(v("CaCl2"), 111);
  assert.equal(v("NH3"), 17);
  assert.equal(v("Ca(OH)2"), 74);
  assert.equal(v("CuSO4"), 160);
  assert.equal(v("CuSO4·5H2O"), 250);
  assert.equal(v("H2O"), 18);
  assert.equal(v("H2O", "precise"), 18.015);
  const ga = averageAtomicMass([
    { mass: 69, abundance: 60 },
    { mass: 71, abundance: 40 },
  ]);
  assert.ok(ga.ok && Math.abs(ga.average - 69.8) < 1e-9);
  assert.equal(elementBySymbol("Ga")!.mass, 69.723);
  // جدول ترکیب‌ها: همه تجزیه می‌شوند و تکراری نیستند
  assert.equal(new Set(COMPOUNDS.map((c) => c.f)).size, COMPOUNDS.length);
  assert.ok(COMPOUNDS.length >= 28 && COMPOUNDS.length <= 40);
  for (const c of COMPOUNDS) {
    assert.ok(molarMass(c.f).ok, c.f);
    assert.ok(molarMass(c.f, { mode: "exam" }).ok, c.f);
  }
  for (const f of [...MOLAR_MASS_EXAMPLES, MOLAR_MASS_DEFAULT]) assert.ok(molarMass(f).ok, f);
});

test("عددهای مثال‌های pH با ph.ts یکی است", () => {
  const near = (a: number, b: number, tol = 0.006) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);
  const a = strongAcid({ c: 0.005, formula: "HNO3" });
  assert.ok(a.ok);
  near(a.pH, 2.3, 0.01);
  const b = strongBase({ c: 0.02, n: 2, formula: "Ba(OH)2" });
  assert.ok(b.ok);
  near(b.pH, 12.6, 0.01);
  near(b.H, 2.5e-13, 1e-16);
  const w = weakAcid({ c: 0.1, ka: 1e-5 });
  assert.ok(w.ok && w.weak);
  near(w.weak!.approx.pH, 3);
  near(w.weak!.exact.pH, 3.002, 0.001);
  near(w.weak!.approx.alpha, 0.01, 1e-9);
  const rain = convertPh({ from: "pH", value: 5.6 });
  assert.ok(rain.ok);
  near(rain.H / 1e-6, 2.5, 0.02);
  near(rain.OH / 1e-9, 4, 0.02);
  const dilute = strongAcid({ c: 1e-8, formula: "HCl" });
  assert.ok(dilute.ok);
  near(dilute.pH, 6.98);
  // پیش‌فرض‌های ابزار
  const hcl = strongAcid({ c: "0.01", n: "1", formula: "HCl" });
  assert.ok(hcl.ok);
  near(hcl.pH, 2);
});

test("داده‌ی جدول تناوبی با متن راهنما و constants.ts می‌خواند", () => {
  assert.equal(ELEMENTS.length, 118);
  LEVEL_ELEMENTS.forEach(([sym, fa], i) => {
    assert.equal(ELEMENTS[i].symbol, sym);
    assert.equal(ELEMENTS[i].fa, fa, `نام عنصر ${sym}`);
  });
  const liquids = ELEMENTS.filter((e) => e.phase === "liquid").map((e) => e.symbol);
  assert.deepEqual(liquids.sort(), ["Br", "Hg"]);
  const gases = ELEMENTS.filter((e) => e.phase === "gas").map((e) => e.symbol);
  assert.deepEqual(gases.sort(), ["Ar", "Cl", "F", "H", "He", "Kr", "N", "Ne", "O", "Rn", "Xe"].sort());
  const metalloids = ELEMENTS.filter((e) => e.category === "metalloid").map((e) => e.symbol);
  assert.deepEqual(metalloids, ["B", "Si", "Ge", "As", "Sb", "Te"]);
  assert.equal(elementBySymbol("F")!.electronegativity, 3.98);
  for (const s of ["He", "Ne", "Ar"]) assert.equal(elementBySymbol(s)!.electronegativity, null);
  assert.equal(elementBySymbol("Cl")!.config, "[Ne] 3s2 3p5");
  assert.equal(elementBySymbol("Cr")!.config, "[Ar] 3d5 4s1");
  assert.equal(elementBySymbol("Cu")!.config, "[Ar] 3d10 4s1");
  assert.equal(elementBySymbol("Rn")!.massText, "[222]");
  assert.equal(fullConfig(elementBySymbol("He")!), "1s2");
  assert.equal(elementBySymbol("He")!.block, "s");
  // ناوبری با کلیدها: Y ↓ La (از روی خانه‌های جای‌نگهدار)، Na → Mg، He ↓ Ne
  assert.equal(neighbor(39, 1, 0), 57);
  assert.equal(neighbor(11, 0, 1), 12);
  assert.equal(neighbor(2, 1, 0), 10);
  assert.equal(neighbor(1, -1, 0), null);
  // جست‌وجو
  assert.equal(searchElements("آهن")[0].symbol, "Fe");
  assert.equal(searchElements("fe")[0].symbol, "Fe");
  assert.equal(searchElements("۲۶")[0].symbol, "Fe");
  assert.equal(searchElements("آهن".replace("ی", "ي"))[0]?.symbol, "Fe");
  assert.equal(searchElements("كلر")[0]?.symbol, "Cl");
});

const RAW = /(?<![A-Za-z0-9_/.:#=-])[A-Z][a-z]?\d/;
const visibleNoChem = (html: string) =>
  html
    .replace(/<bdi\b[^>]*class="[^"]*\bchem\b[^"]*"[^>]*>[\s\S]*?<\/bdi>/gi, " ")
    .replace(/<(code|pre|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");

test("جزیره‌ها در HTML سرور نتیجه‌ی نمونه‌ی پیش‌فرض را دارند", () => {
  const mm = renderToStaticMarkup(h(MolarMassTool, { examples: MOLAR_MASS_EXAMPLES, initial: MOLAR_MASS_DEFAULT }));
  assert.ok(mm.includes("۱۸۰٫۱۵۶"), "جرم مولی گلوکز");
  const avg = renderToStaticMarkup(h(AverageMassTool));
  assert.ok(avg.includes("۳۵٫۵"), "جرم اتمی میانگین کلر");
  const bal = renderToStaticMarkup(h(BalanceTool, { examples: BALANCE_EXAMPLES, initial: BALANCE_DEFAULT }));
  assert.ok(bal.includes("5O<sub>2</sub>") && bal.includes("3CO<sub>2</sub>") && bal.includes("4H<sub>2</sub>O"), "ضریب‌های پروپان");
  const ph = renderToStaticMarkup(h(PhTool));
  for (const v of ["۲٫۰۰", "۲٫۸۷", "۲٫۸۸", "۳٫۰۰"]) assert.ok(ph.includes(v), `pH ${v}`);
  const pt = renderToStaticMarkup(h(PeriodicTable, { molarMassPath: null }));
  assert.ok(pt.includes("کلر") && pt.includes("۳٫۱۶"), "کادر مشخصات کلر");
  assert.equal((pt.match(/aria-pressed="true"/g) || []).length, 1, "فقط یک عنصر انتخاب‌شده");
  assert.equal((pt.match(/tabindex="0"/g) || []).length, 1, "یک توقف Tab در شبکه‌ی جدول");
  const list = renderToStaticMarkup(h(ElementList));
  assert.equal((list.match(/<tr>/g) || []).length, 119);
  for (const [name, html] of Object.entries({ mm, avg, bal, ph, pt, list })) {
    const t = visibleNoChem(html);
    assert.ok(!RAW.test(t), `${name}: فرمول خام بیرون از .chem: ${/.{0,20}[A-Z][a-z]?\d.{0,20}/.exec(t)?.[0]}`);
    assert.ok(!/(->|<=>|=>)/.test(t), `${name}: پیکان خام`);
    assert.ok(!/[يك]/.test(t), `${name}: «ی/ک» عربی`);
  }
});
