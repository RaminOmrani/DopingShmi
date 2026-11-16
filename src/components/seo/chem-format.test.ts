/** آزمون توکن‌ساز فرمول و کامپوننت‌های Chem/Eq/ChemText (اجرا: pnpm test:chem) */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chemPlain, chemTextPlain, hasArrow, splitChemText, tokenizeChem } from "./chem-format";
import { Chem, ChemText, Eq } from "./Chem";
import { chapterPath, crumbsFor, isLive, parseFasl, parseQuizSlug, quizParams, quizPath, route, SEO_ROUTES } from "../../lib/site-routes";

test("زیروند، ضریب، پرانتز و کروشه", () => {
  assert.equal(chemPlain("H2O"), "H₂O");
  assert.equal(chemPlain("2H2O"), "2H₂O");
  assert.equal(chemPlain("Ca(OH)2"), "Ca(OH)₂");
  assert.equal(chemPlain("Al2(SO4)3"), "Al₂(SO₄)₃");
  assert.equal(chemPlain("K4[Fe(CN)6]"), "K₄[Fe(CN)₆]");
  assert.equal(chemPlain("CH3COOH"), "CH₃COOH");
  assert.equal(chemPlain("1/2O2"), "1/2O₂");
  assert.equal(chemPlain("H۲O"), "H₂O"); // رقم فارسی
  assert.deepEqual(tokenizeChem("2H2O").map((t) => t.t), ["coef", "el", "sub", "el"]);
});

test("آب تبلور", () => {
  for (const f of ["CuSO4.5H2O", "CuSO4*5H2O", "CuSO4·5H2O"]) assert.equal(chemPlain(f), "CuSO₄·5H₂O");
  assert.equal(chemPlain("1.0"), "1.0"); // نقطه‌ی اعشار جداکننده نیست
});

test("بار و الکترون", () => {
  assert.equal(chemPlain("SO4^2-"), "SO₄²⁻");
  assert.equal(chemPlain("NH4^+"), "NH₄⁺");
  assert.equal(chemPlain("NH4+"), "NH₄⁺");
  assert.equal(chemPlain("Fe^{3+}"), "Fe³⁺");
  assert.equal(chemPlain("Fe^3+"), "Fe³⁺");
  assert.equal(chemPlain("Cl-"), "Cl⁻");
  assert.equal(chemPlain("e^-"), "e⁻");
  assert.equal(chemPlain("2e-"), "2e⁻");
  assert.equal(chemPlain("Na+(aq)"), "Na⁺(aq)");
  assert.equal(chemPlain("1.0×10^-14"), "1.0×10⁻¹⁴");
  assert.equal(chemPlain("C_{n}H_{2n+2}"), "CₙH₂ₙ₊₂");
  assert.equal(chemPlain("K_a"), "Kₐ");
});

test("حالت فیزیکی و معادله", () => {
  assert.deepEqual(tokenizeChem("H2O(l)").at(-1), { t: "state", v: "(l)" });
  assert.equal(chemPlain("2H2(g) + O2(g) -> 2H2O(l)"), "2H₂(g) + O₂(g) → 2H₂O(l)");
  assert.equal(chemPlain("H2+O2->H2O"), "H₂ + O₂ → H₂O");
  assert.equal(chemPlain("N2 + 3H2 <=> 2NH3"), "N₂ + 3H₂ ⇌ 2NH₃");
  assert.equal(chemPlain("Na+ + Cl-"), "Na⁺ + Cl⁻");
  assert.equal(chemPlain("MnO4^- + 8H^+ + 5e^- -> Mn^2+ + 4H2O"), "MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O");
  assert.equal(chemPlain("CH3-CH3"), "CH₃-CH₃");
  assert.ok(hasArrow("A -> B") && hasArrow("A ⇌ B") && !hasArrow("H2SO4"));
});

test("ChemText: فرمول، معادله و پررنگ", () => {
  const segs = splitChemText("اسید {{H2SO4}} و **باز {{NaOH}}** و {{A -> B}}");
  assert.deepEqual(segs.map((s) => s.t), ["text", "chem", "text", "bold", "text", "eq"]);
  assert.equal(chemTextPlain("محلول {{CuSO4.5H2O}} **آبی** است"), "محلول CuSO₄·5H₂O آبی است");
  assert.equal(chemTextPlain("{{H2O}}", { isolate: true }), "⁦H₂O⁩");
});

test("خروجی HTML کامپوننت‌ها", () => {
  assert.equal(renderToStaticMarkup(createElement(Chem, { f: "H2O" })), '<bdi dir="ltr" translate="no" class="chem whitespace-nowrap">H<sub>2</sub>O</bdi>');
  assert.match(renderToStaticMarkup(createElement(Chem, { f: "SO4^2-" })), /S<!-- -->O<sub>4<\/sub><sup>2−<\/sup>|SO<sub>4<\/sub><sup>2−<\/sup>/);
  const eq = renderToStaticMarkup(createElement(Eq, { f: "2H2 + O2 -> 2H2O" }));
  assert.match(eq, /^<bdi dir="ltr" translate="no" class="chem chem-eq/);
  assert.match(eq, /→/);
  assert.ok(!/<div|<p/.test(eq), "Eq باید محتوای درون‌خطی باشد");
  const t = renderToStaticMarkup(createElement(ChemText, { text: "آب {{H2O}} و **مهم**" }));
  assert.match(t, /^آب <bdi[^>]*class="chem[^"]*">H<sub>2<\/sub>O<\/bdi> و <strong>مهم<\/strong>$/);
});

test("site-routes: مسیرها و live", () => {
  assert.equal(chapterPath("G12", 4), "/shimi-davazdahom/fasl-4");
  assert.equal(quizPath("G11", 2), "/azmoon-shimi/yazdahom-fasl-2");
  // ۲۶ صفحه‌ی برنامه‌ریزی‌شده (فصل، آزمون، ابزار، برگه‌ی فرمول)؛ live بودنشان در یکپارچه‌سازی تعیین می‌شود
  assert.equal(SEO_ROUTES.filter((r) => ["chapter", "quiz", "tool", "reference"].includes(r.group)).length, 26);
  assert.equal(new Set(SEO_ROUTES.map((r) => r.path)).size, SEO_ROUTES.length);
  assert.equal(route("/shimi-dahom/fasl-1/")?.label, "فصل اول شیمی دهم");
  assert.equal(route(quizPath("G10", 1))?.label, "آزمون آنلاین فصل اول شیمی دهم");
  assert.ok(isLive("/shimi-dahom") && isLive("/courses/abc") && isLive("/login") && isLive("https://example.com"));
  // مسیر ثبت‌شده: همان مقدار live؛ زیرمسیر ثبت‌نشده در فضای نام برنامه‌ریزی‌شده: هرگز
  for (const p of ["/shimi-dahom/fasl-1", "/azmoon-shimi", "/mohasebe-ph"]) assert.equal(isLive(p), route(p)!.live);
  assert.ok(!isLive("/shimi-dahom/fasl-4") && !isLive("/azmoon-shimi/dahom-fasl-4") && !isLive("/shimi-yazdahom/foo"));
  assert.equal(parseFasl("fasl-4", "G10"), null);
  assert.equal(parseFasl("fasl-4", "G12"), 4);
  assert.deepEqual(parseQuizSlug("davazdahom-fasl-3"), { g: "G12", n: 3 });
  assert.equal(parseQuizSlug("dahom-fasl-4"), null);
  assert.equal(quizParams().length, 10);
  assert.deepEqual(crumbsFor("/shimi-dahom/fasl-1").map((c) => c.name), ["دوپینگ شیمی", "شیمی دهم", "فصل اول"]);
  // والد غیر live (مثلاً هاب آزمون پیش از انتشار) از مسیر راهنما حذف می‌شود
  assert.deepEqual(
    crumbsFor(quizPath("G10", 1)).map((c) => c.path),
    route("/azmoon-shimi")!.live ? ["/", "/azmoon-shimi", "/azmoon-shimi/dahom-fasl-1"] : ["/", "/azmoon-shimi/dahom-fasl-1"],
  );
  for (const r of SEO_ROUTES) assert.match(r.updated, /^\d{4}-\d{2}-\d{2}$/);
  for (const r of SEO_ROUTES) assert.ok(!/[يك]/.test(r.label), `ی/ک عربی در ${r.path}`);
});
