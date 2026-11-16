/** آزمون موازنه‌ی معادله (اجرا: pnpm test:chem) */
import test from "node:test";
import assert from "node:assert/strict";
import { balanceEquation, type BalanceOk } from "./balance";

function bal(eq: string): BalanceOk {
  const r = balanceEquation(eq);
  if (!r.ok) throw new Error(`${eq}: ${r.error}`);
  return r;
}
const coefs = (eq: string) => bal(eq).coefficients;

test("سوختن هیدروژن و هیدروکربن‌ها", () => {
  assert.deepEqual(coefs("H2+O2→H2O"), [2, 1, 2]);
  assert.deepEqual(coefs("CH4+O2→CO2+H2O"), [1, 2, 1, 2]);
  assert.deepEqual(coefs("C3H8+O2→CO2+H2O"), [1, 5, 3, 4]);
  assert.deepEqual(coefs("C2H6 + O2 -> CO2 + H2O"), [2, 7, 4, 6]);
  assert.deepEqual(coefs("C6H12O6 + O2 -> CO2 + H2O"), [1, 6, 6, 6]);
  assert.deepEqual(coefs("C2H5OH + O2 = CO2 + H2O"), [1, 3, 2, 3]);
});

test("فلز و اکسیژن، فلز و اسید", () => {
  assert.deepEqual(coefs("Fe+O2→Fe2O3"), [4, 3, 2]);
  assert.deepEqual(coefs("Al+HCl→AlCl3+H2"), [2, 6, 2, 3]);
  assert.deepEqual(coefs("Mg + O2 -> MgO"), [2, 1, 2]);
  assert.deepEqual(coefs("Na + H2O -> NaOH + H2"), [2, 2, 2, 1]);
});

test("جابه‌جایی دوگانه و پرانتز", () => {
  assert.deepEqual(coefs("Al2(SO4)3 + Ca(OH)2 -> Al(OH)3 + CaSO4"), [1, 3, 2, 3]);
  assert.deepEqual(coefs("AgNO3 + BaCl2 -> AgCl + Ba(NO3)2"), [2, 1, 2, 1]);
  assert.deepEqual(coefs("Ca3(PO4)2 + H2SO4 -> CaSO4 + H3PO4"), [1, 3, 3, 2]);
});

test("اکسایش–کاهش مولکولی", () => {
  assert.deepEqual(coefs("KMnO4+HCl→KCl+MnCl2+H2O+Cl2"), [2, 16, 2, 2, 8, 5]);
  assert.deepEqual(coefs("Cu+HNO3→Cu(NO3)2+NO+H2O"), [3, 8, 3, 2, 4]);
  assert.deepEqual(coefs("K2Cr2O7 + HCl -> KCl + CrCl3 + Cl2 + H2O"), [1, 14, 2, 2, 3, 7]);
});

test("معادله‌ی یونی با پایستگی بار", () => {
  const r = bal("MnO4^- + Fe^2+ + H^+ → Mn^2+ + Fe^3+ + H2O");
  assert.deepEqual(r.coefficients, [1, 5, 8, 1, 5, 4]);
  assert.equal(r.ionic, true);
  const q = r.tally.find((t) => t.key === "charge")!;
  assert.equal(q.left, 17);
  assert.equal(q.right, 17);
  assert.equal(r.equation, "MnO4^- + 5Fe^2+ + 8H^+ -> Mn^2+ + 5Fe^3+ + 4H2O");
  assert.deepEqual(coefs("Cr2O7^2- + Fe^2+ + H^+ -> Cr^3+ + Fe^3+ + H2O"), [1, 6, 14, 2, 6, 7]);
});

test("نیم‌واکنش با الکترون", () => {
  assert.deepEqual(coefs("Fe^3+ + e- -> Fe^2+"), [1, 1, 1]);
  assert.deepEqual(coefs("MnO4^- + H^+ + e^- -> Mn^2+ + H2O"), [1, 8, 5, 1, 4]);
  assert.deepEqual(coefs("Cu -> Cu^2+ + e-"), [1, 1, 2]);
});

test("آب تبلور، کروشه و رقم فارسی", () => {
  assert.deepEqual(coefs("CuSO4·5H2O -> CuSO4 + H2O"), [1, 1, 5]);
  assert.deepEqual(coefs("K4[Fe(CN)6] + H2SO4 + H2O -> K2SO4 + FeSO4 + (NH4)2SO4 + CO"), [1, 6, 6, 2, 1, 3, 6]);
  assert.deepEqual(coefs("C۳H۸ + O۲ = CO۲ + H۲O"), [1, 5, 3, 4]);
});

test("پیکان تعادلی حفظ می‌شود و ضریب‌های ورودی نادیده گرفته می‌شوند", () => {
  const r = bal("N2 + H2 <=> NH3");
  assert.deepEqual(r.coefficients, [1, 3, 2]);
  assert.equal(r.equation, "N2 + 3H2 <=> 2NH3");
  const w = bal("4H2 + O2 -> H2O");
  assert.deepEqual(w.coefficients, [2, 1, 2]);
  assert.match(w.warnings.join(), /نادیده/);
});

test("شمارش اتم‌ها پس از موازنه و مرحله‌ها", () => {
  const r = bal("C3H8 + O2 -> CO2 + H2O");
  assert.deepEqual(r.tally, [
    { key: "C", left: 3, right: 3 },
    { key: "H", left: 8, right: 8 },
    { key: "O", left: 10, right: 10 },
  ]);
  assert.equal(r.steps.length, 4);
  assert.deepEqual(r.steps[1].math, ["{{C}}: 3a = c", "{{H}}: 8a = 2d", "{{O}}: 2b = 2c + d"]);
  assert.equal(r.equation, "C3H8 + 5O2 -> 3CO2 + 4H2O");
});

test("خطا: عنصر فقط در یک سمت", () => {
  const r = balanceEquation("H2 -> O2");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, "impossible");
    assert.match(r.error, /فقط در واکنش‌دهنده‌ها/);
    assert.match(r.error, /فقط در فراورده‌ها/);
  }
});

test("ابهام: دو موازنه‌ی مستقل", () => {
  const r = balanceEquation("H2 + O2 -> H2O + H2O2");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, "ambiguous");
    assert.match(r.error, /یکتا نیستند/);
  }
});

test("ناممکن: ضریب صفر یا گونه در سمت نادرست", () => {
  const z = balanceEquation("H2 + O2 + N2 -> H2O + N2O5 + NO2 + NO");
  // این دستگاه چند جواب مستقل دارد
  assert.equal(z.ok, false);
  const s = balanceEquation("H2O -> H2 + O2 + H2O2");
  assert.equal(s.ok, false);
  const wrong = balanceEquation("Fe^3+ -> Fe^2+ + e-");
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.match(wrong.error, /سمت دیگر/);
  const nobal = balanceEquation("Na^+ -> Na");
  assert.equal(nobal.ok, false);
});

test("Fe3+ بدون ^ : شکست با هشدار راهنما", () => {
  const r = balanceEquation("Fe3+ + e- -> Fe2+");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.warnings.join(), /Fe\^3\+/);
});

test("خطاهای ورودی", () => {
  const cases: [string, RegExp][] = [
    ["", /وارد نشده/],
    ["H2 + O2", /پیکان/],
    ["H2 + -> H2O", /خالی/],
    ["H2 + Xx -> H2O", /عنصر Xx وجود ندارد/],
    ["Ca(OH2 -> CaO + H2O", /بسته نشده/],
    ["-> H2O", /خالی/],
  ];
  for (const [eq, re] of cases) {
    const r = balanceEquation(eq);
    assert.equal(r.ok, false, eq);
    if (!r.ok) assert.match(r.error, re, eq);
  }
});
