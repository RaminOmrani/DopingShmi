/** آزمون جرم مولی، تبدیل مقدار و جرم اتمی میانگین (اجرا: pnpm test:chem) */
import test from "node:test";
import assert from "node:assert/strict";
import { averageAtomicMass, convertAmount, DEFAULT_ISOTOPES, massOf, molarMass } from "./molar-mass";
import { ATOMIC_MASS, EXAM_MASSES, EXAM_MASSES_TEACHER_CONFIRMED } from "./masses";

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);
const mm = (f: string, mode: "precise" | "exam" = "precise") => {
  const r = molarMass(f, { mode });
  if (!r.ok) throw new Error(r.error);
  return r;
};

test("جرم مولی دقیق ترکیب‌های رایج (±۰٫۰۱)", () => {
  const cases: [string, number][] = [
    ["H2O", 18.015],
    ["CO2", 44.009],
    ["NaCl", 58.44],
    ["C6H12O6", 180.16],
    ["H2SO4", 98.07],
    ["CaCO3", 100.09],
    ["Ca3(PO4)2", 310.18],
    ["CuSO4·5H2O", 249.68],
    ["CuSO4.5H2O", 249.68],
    ["NH3", 17.031],
    ["Al2(SO4)3", 342.13],
  ];
  for (const [f, v] of cases) near(mm(f).total, v);
});

test("حالت امتحانی: H2SO4 = 98 و NaCl = 58.5", () => {
  assert.equal(mm("H2SO4", "exam").value, 98);
  assert.equal(mm("H2SO4", "exam").valueText, "98");
  assert.equal(mm("NaCl", "exam").value, 58.5);
  assert.equal(mm("NaCl", "exam").valueText, "58.5");
  assert.equal(mm("CaCO3", "exam").value, 100);
  assert.equal(mm("CuSO4·5H2O", "exam").value, 250);
  assert.equal(EXAM_MASSES_TEACHER_CONFIRMED, false);
});

test("ردیف‌های جدول: تعداد × جرم = سهم، به ترتیب فرمول", () => {
  const r = mm("H2SO4");
  assert.deepEqual(
    r.rows.map((x) => x.symbol),
    ["H", "S", "O"],
  );
  const o = r.rows.find((x) => x.symbol === "O")!;
  assert.equal(o.count, 4);
  near(o.subtotal, 4 * 15.999, 1e-9);
  assert.equal(r.steps.length, 3);
  assert.match(r.steps[1].math![2], /4 × 15\.999 = 63\.996/);
});

test("رقم اعشار گزارش با قاعده‌ی جمع", () => {
  assert.equal(mm("NaCl").valueText, "58.44"); // Cl با دو رقم اعشار
  assert.equal(mm("H2O").valueText, "18.015");
  assert.equal(mm("H2SO4").valueText, "98.07"); // S = 32.06
});

test("هشدار آب تبلور، ضریب، بار و عنصر پرتوزا", () => {
  const h = mm("CuSO4·5H2O");
  assert.match(h.steps[0].text!, /آب تبلور/);
  assert.match(mm("2H2O").warnings.join(), /ضریب/);
  assert.match(mm("SO4^2-").warnings.join(), /الکترون/);
  const tc = mm("TcO4^-");
  assert.ok(tc.rows[0].massNumberOnly);
  assert.match(tc.warnings.join(), /پایدارترین ایزوتوپ/);
  // حالت امتحانی بدون مقدار گردشده → جرم دقیق با هشدار
  const rb = mm("RbCl", "exam");
  assert.equal(rb.rows[0].source, "fallback");
  assert.match(rb.warnings.join(), /جرم دقیق/);
});

test("خطای جرم مولی", () => {
  const r = molarMass("Xx");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "عنصر Xx وجود ندارد.");
  assert.equal(molarMass("e-").ok, false);
  assert.throws(() => massOf("Ca(OH2"));
});

test("massOf برای جدول‌های ساخته‌شده در build", () => {
  assert.equal(massOf("NaOH"), 39.997);
  assert.equal(massOf("NaOH", "exam"), 40);
});

test("تبدیل گرم ↔ مول ↔ ذره (عدد آووگادرو کتاب)", () => {
  const r = convertAmount({ value: 9, from: "g", molarMass: 18, formula: "H2O", particle: "مولکول" });
  assert.ok(r.ok);
  if (!r.ok) return;
  near(r.moles, 0.5, 1e-12);
  near(r.particles / 1e23, 3.01, 1e-9);
  assert.match(r.steps[0].math![0], /9 g \{\{H2O\}\} × \(1 mol \{\{H2O\}\} \/ 18 g \{\{H2O\}\}\) = 0\.5 mol/);
  assert.match(r.steps[1].math![0], /3\.01×\{\{10\^23\}\}/);

  const m = convertAmount({ value: "۲", from: "mol", molarMass: 44 });
  assert.ok(m.ok && m.grams === 88);
  const n = convertAmount({ value: "1.204e24", from: "particles", molarMass: 18 });
  assert.ok(n.ok);
  if (n.ok) {
    near(n.moles, 2, 1e-9);
    near(n.grams, 36, 1e-9);
  }
  assert.equal(convertAmount({ value: -1, from: "g", molarMass: 18 }).ok, false);
});

test("جرم اتمی میانگین: نمونه‌ی کلر → ۳۵٫۵", () => {
  const r = averageAtomicMass(DEFAULT_ISOTOPES);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.average, 35.5);
  const w = averageAtomicMass([
    { mass: 63, abundance: 69 },
    { mass: 65, abundance: 30 },
  ]);
  assert.ok(w.ok && w.warnings.length === 1);
  assert.equal(averageAtomicMass([{ mass: 10, abundance: 80 }, { mass: 11, abundance: 30 }]).ok, false);
  assert.equal(averageAtomicMass([]).ok, false);
});

test("جرم‌های امتحانی همه نماد معتبر دارند", () => {
  for (const s of Object.keys(EXAM_MASSES)) assert.ok(ATOMIC_MASS[s] !== undefined, s);
  // اختلاف هیچ مقدار گردشده‌ای با جرم دقیق از ۰٫۶ بیشتر نیست
  for (const [s, v] of Object.entries(EXAM_MASSES)) assert.ok(Math.abs(v - ATOMIC_MASS[s]) <= 0.6, s);
});
