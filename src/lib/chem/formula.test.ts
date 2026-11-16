/** آزمون یکسان‌سازی ورودی، کسر گویا و تجزیه‌ی فرمول (اجرا: pnpm test:chem) */
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChemText, parseNumberInput, splitEquation, splitSpecies, toAsciiDigits } from "./normalize";
import { Frac, bgcd, blcm, nullSpace, toSmallestIntegers } from "./rational";
import { chargeSuffix, parseFormula, tryParseFormula } from "./formula";
import { ChemError, faDigits, sci, sciMath } from "./common";

const counts = (f: string) => parseFormula(f).counts;

test("یکسان‌سازی: رقم فارسی و عربی، زیروند و بالانویس یونیکد", () => {
  assert.equal(toAsciiDigits("۱۲۳٫۵"), "123.5");
  assert.equal(toAsciiDigits("٤٥"), "45");
  assert.equal(normalizeChemText("H۲SO۴"), "H2SO4");
  assert.equal(normalizeChemText("SO₄²⁻"), "SO4^2-");
  assert.equal(normalizeChemText("NH₄⁺"), "NH4^+");
  assert.equal(normalizeChemText("Fe−"), "Fe-");
  assert.equal(normalizeChemText("H‌2O"), "H2O"); // نیم‌فاصله‌ی کپی‌شده
});

test("یکسان‌سازی: جداکننده‌های آب تبلور", () => {
  for (const f of ["CuSO4·5H2O", "CuSO4.5H2O", "CuSO4*5H2O", "CuSO4•5H2O", "CuSO4⋅5H2O"]) assert.equal(normalizeChemText(f), "CuSO4·5H2O");
  assert.equal(normalizeChemText("H2O."), "H2O"); // نقطه‌ی پایان جمله
});

test("جدا کردن دو سمت معادله با انواع پیکان", () => {
  for (const eq of ["H2 + O2 -> H2O", "H2 + O2 → H2O", "H2 + O2 = H2O", "H2 + O2 ⟶ H2O", "H2 + O2 --> H2O", "H2 + O2 => H2O"]) {
    const r = splitEquation(eq);
    assert.equal(r.arrow, "→");
    assert.equal(r.left, "H2 + O2");
    assert.equal(r.right, "H2O");
  }
  assert.equal(splitEquation("N2 + 3H2 <=> 2NH3").arrow, "⇌");
  assert.equal(splitEquation("N2 + 3H2 ⇌ 2NH3").arrow, "⇌");
  assert.throws(() => splitEquation("H2 + O2"), /پیکان/);
  assert.throws(() => splitEquation("A -> B -> C"), /فقط یک پیکان/);
  assert.throws(() => splitEquation("-> H2O"), /واکنش‌دهنده‌ها خالی/);
});

test("جدا کردن گونه‌ها: «+» بار در برابر «+» جداکننده", () => {
  assert.deepEqual(splitSpecies("H2+O2"), ["H2", "O2"]);
  assert.deepEqual(splitSpecies("Na+ + Cl-"), ["Na+", "Cl-"]);
  assert.deepEqual(splitSpecies("NH4++OH-"), ["NH4+", "OH-"]);
  assert.deepEqual(splitSpecies("MnO4^- + Fe^2+ + H^+"), ["MnO4^-", "Fe^2+", "H^+"]);
  assert.deepEqual(splitSpecies("Fe^2++e-"), ["Fe^2+", "e-"]);
  assert.deepEqual(splitSpecies("H^++OH^-"), ["H^+", "OH^-"]);
  assert.deepEqual(splitSpecies("Na+(aq) + Cl-(aq)"), ["Na+(aq)", "Cl-(aq)"]);
});

test("عدد ورودی: رقم فارسی، نماد علمی و ×10^", () => {
  assert.equal(parseNumberInput("۰٫۰۱"), 0.01);
  assert.equal(parseNumberInput("1.8e-5"), 1.8e-5);
  assert.ok(Math.abs(parseNumberInput("1.8×10^-5")! - 1.8e-5) < 1e-20);
  assert.ok(Math.abs(parseNumberInput("1.8 x 10⁻⁵")! - 1.8e-5) < 1e-20);
  assert.ok(Math.abs(parseNumberInput("۱٫۸×۱۰^-۵")! - 1.8e-5) < 1e-20);
  assert.equal(parseNumberInput("10^-3"), 1e-3);
  assert.equal(parseNumberInput("0,5"), 0.5);
  assert.equal(parseNumberInput("abc"), null);
  assert.equal(parseNumberInput(""), null);
});

test("کسر BigInt: ساده‌سازی، عملیات، ب.م.م و ک.م.م", () => {
  assert.equal(new Frac(6n, -4n).toString(), "-3/2");
  assert.equal(Frac.of(1, 2).add(Frac.of(1, 3)).toString(), "5/6");
  assert.equal(Frac.of(3, 4).mul(Frac.of(2, 3)).toString(), "1/2");
  assert.equal(Frac.of(1, 2).div(Frac.of(1, 4)).toString(), "2");
  assert.equal(Frac.of(1, 2).sub(Frac.of(1, 2)).isZero(), true);
  assert.equal(bgcd(12n, -18n), 6n);
  assert.equal(blcm(4n, 6n), 12n);
  assert.throws(() => Frac.of(1, 0));
  assert.deepEqual(toSmallestIntegers([Frac.of(1, 2), Frac.of(1), Frac.of(3, 4)]), [2n, 4n, 3n]);
});

test("فضای پوچ دقیق", () => {
  // H2 + O2 → H2O: [[2,0,-2],[0,2,-1]]
  const m = [
    [2, 0, -2],
    [0, 2, -1],
  ].map((r) => r.map((x) => Frac.of(x)));
  const ns = nullSpace(m);
  assert.equal(ns.length, 1);
  assert.deepEqual(toSmallestIntegers(ns[0]), [2n, 1n, 2n]);
});

test("فرمول ساده و پرانتزدار", () => {
  assert.deepEqual(counts("H2O"), { H: 2, O: 1 });
  assert.deepEqual(counts("Ca(OH)2"), { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(counts("Al2(SO4)3"), { Al: 2, S: 3, O: 12 });
  assert.deepEqual(counts("CH3COOH"), { C: 2, H: 4, O: 2 });
  assert.deepEqual(counts("Co"), { Co: 1 });
  assert.deepEqual(counts("CO"), { C: 1, O: 1 });
});

test("پرانتز و کروشه‌ی تودرتو", () => {
  assert.deepEqual(counts("K4[Fe(CN)6]"), { K: 4, Fe: 1, C: 6, N: 6 });
  assert.deepEqual(counts("Ca3(PO4)2"), { Ca: 3, P: 2, O: 8 });
  assert.deepEqual(counts("[Cu(NH3)4]SO4"), { Cu: 1, N: 4, H: 12, S: 1, O: 4 });
  assert.deepEqual(counts("Mg3[Fe(CN)6]2"), { Mg: 3, Fe: 2, C: 12, N: 12 });
  assert.deepEqual(counts("((CH3)3C)2O"), { C: 8, H: 18, O: 1 });
});

test("آب تبلور با سه جداکننده", () => {
  for (const f of ["CuSO4·5H2O", "CuSO4.5H2O", "CuSO4*5H2O"]) {
    const p = parseFormula(f);
    assert.deepEqual(p.counts, { Cu: 1, S: 1, O: 9, H: 10 });
    assert.equal(p.parts.length, 2);
    assert.equal(p.parts[1].multiplier, 5);
    assert.equal(p.body, "CuSO4·5H2O");
  }
  assert.deepEqual(counts("Na2CO3·10H2O"), { Na: 2, C: 1, O: 13, H: 20 });
  assert.deepEqual(counts("KAl(SO4)2·12H2O"), { K: 1, Al: 1, S: 2, O: 20, H: 24 });
});

test("یون‌ها: ^، پسوند جدا و علامت انتهایی", () => {
  const nh4 = parseFormula("NH4^+");
  assert.deepEqual(nh4.counts, { N: 1, H: 4 });
  assert.equal(nh4.charge, 1);
  assert.equal(nh4.warnings.length, 0);
  const so4 = parseFormula("SO4^2-");
  assert.equal(so4.charge, -2);
  assert.deepEqual(so4.counts, { S: 1, O: 4 });
  assert.equal(so4.display, "SO4^2-");
  assert.equal(parseFormula("Fe^{3+}").charge, 3);
  assert.equal(parseFormula("PO4^-3").charge, -3);
  assert.equal(parseFormula("SO4 2-").charge, -2);
  assert.equal(parseFormula("Na+").charge, 1);
  assert.equal(parseFormula("Cl-").charge, -1);
  assert.equal(parseFormula("NO3-").warnings.length, 0);
  assert.equal(parseFormula("SO₄²⁻").charge, -2);
  assert.equal(chargeSuffix(-2), "^2-");
  assert.equal(chargeSuffix(1), "^+");
});

test("Fe3+ بدون ^ مثل نمایش <Chem> خوانده می‌شود و هشدار می‌دهد", () => {
  const p = parseFormula("Fe3+");
  assert.deepEqual(p.counts, { Fe: 3 });
  assert.equal(p.charge, 1);
  assert.match(p.warnings[0], /Fe\^3\+/);
  assert.match(parseFormula("SO42-").warnings[0], /SO4\^2-/);
});

test("الکترون، ضریب و حالت فیزیکی", () => {
  const e = parseFormula("e-");
  assert.equal(e.isElectron, true);
  assert.equal(e.charge, -1);
  assert.equal(parseFormula("e^-").isElectron, true);
  assert.equal(parseFormula("2e-").coefficient, 2);
  const w = parseFormula("2H2O(l)");
  assert.equal(w.coefficient, 2);
  assert.equal(w.state, "l");
  assert.deepEqual(w.counts, { H: 2, O: 1 });
  assert.equal(parseFormula("Na^+(aq)").display, "Na^+(aq)");
  assert.equal(parseFormula("۳H۲O").coefficient, 3);
});

test("خطاها با پیام فارسی", () => {
  assert.throws(() => parseFormula("Xx2"), (e: unknown) => e instanceof ChemError && e.message === "عنصر Xx وجود ندارد.");
  assert.throws(() => parseFormula("Ca(OH2"), /پرانتز «\u2066\(\u2069» بسته نشده/);
  assert.throws(() => parseFormula("K4[Fe(CN)6"), /کروشه «\u2066\[\u2069» بسته نشده/);
  assert.throws(() => parseFormula("Ca(OH]2"), /با «\u2066\]\u2069» بسته شده/);
  assert.throws(() => parseFormula("CaOH)2"), /اضافه است/);
  assert.throws(() => parseFormula("h2o"), /حرف بزرگ/);
  assert.throws(() => parseFormula("H0"), /زیروند صفر/);
  assert.throws(() => parseFormula("()2"), /پرانتز خالی/);
  assert.throws(() => parseFormula("CuSO4·"), /آب تبلور نیامده/);
  assert.throws(() => parseFormula("H2O!"), /مجاز نیست/);
  assert.throws(() => parseFormula(""), /وارد نشده/);
  assert.throws(() => parseFormula("e"), /e-/);
  const r = tryParseFormula("Qq");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "unknown-element");
});

test("قالب‌بندی عدد", () => {
  assert.equal(faDigits("98.07"), "۹۸٫۰۷");
  assert.equal(sci(3.0107e23), "3.01×10^23");
  assert.equal(sci(0.01, 2, true), "1.0×10^-2");
  assert.equal(sci(9.996e-3, 3, true), "1.00×10^-2");
  assert.equal(sciMath(6.02e23), "6.02×{{10^23}}");
});
