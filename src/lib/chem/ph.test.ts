/** آزمون محاسبه‌ی pH در ۲۵ درجه (اجرا: pnpm test:chem) */
import test from "node:test";
import assert from "node:assert/strict";
import { convertPh, dilution, KW, PH_PRESETS, strongAcid, strongBase, weakAcid, weakBase, type PhOk } from "./ph";

const near = (a: number, b: number, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);
function okr(r: ReturnType<typeof strongAcid>): PhOk {
  if (!r.ok) throw new Error(r.error);
  return r;
}

test("اسید قوی: ۰٫۰۱ مولار HCl → pH = ۲", () => {
  const r = okr(strongAcid({ c: 0.01, formula: "HCl" }));
  near(r.pH, 2);
  near(r.pOH, 12);
  near(r.OH / 1e-12, 1, 1e-9);
  assert.equal(r.nature, "acidic");
  assert.match(r.steps[1].math![0], /pH = −log\{\{\[H\^\+\]\}\} = −log\(1\.0×\{\{10\^-2\}\}\) = 2\.00/);
});

test("باز قوی: ۰٫۰۰۱ مولار NaOH → pH = ۱۱", () => {
  const r = okr(strongBase({ c: 0.001, formula: "NaOH" }));
  near(r.pOH, 3);
  near(r.pH, 11);
  assert.equal(r.nature, "basic");
});

test("باز قوی با دو OH: ۰٫۰۵ مولار Ba(OH)2 → pH = ۱۳", () => {
  const r = okr(strongBase({ c: 0.05, n: 2, formula: "Ba(OH)2" }));
  near(r.OH, 0.1, 1e-12);
  near(r.pH, 13);
  assert.match(r.steps[0].text!, /۲ مول یون/);
});

test("اسید ضعیف: ۰٫۱ مولار CH3COOH با Ka = 1.8e-5 → ≈۲٫۸۷ (تقریبی) و ≈۲٫۸۸ (دقیق)", () => {
  const r = okr(weakAcid({ c: 0.1, ka: 1.8e-5, formula: "CH3COOH" }));
  assert.ok(r.weak);
  assert.equal(r.weak!.approx.pH.toFixed(2), "2.87");
  assert.equal(r.weak!.exact.pH.toFixed(2), "2.88");
  assert.equal(r.pH.toFixed(2), "2.88");
  assert.equal(r.weak!.approxValid, true);
  near(r.weak!.approx.alpha * 100, 1.34, 0.01);
  assert.ok(r.steps.some((s) => /کمتر از ۵٪/.test(s.text ?? "")));
});

test("اسید ضعیف با یونش زیاد: تقریب نامعتبر", () => {
  const r = okr(weakAcid({ c: 0.001, ka: 6.8e-4, formula: "HF" }));
  assert.equal(r.weak!.approxValid, false);
  assert.ok(r.warnings.some((w) => /بیشتر از ۵٪/.test(w)));
  // جواب دقیق باید در معادله‌ی تعادل صدق کند
  const x = r.weak!.exact.x;
  near((x * x) / (0.001 - x), 6.8e-4, 1e-9);
});

test("باز ضعیف: ۰٫۱ مولار NH3 با Kb = 1.8e-5", () => {
  const r = okr(weakBase({ c: 0.1, kb: 1.8e-5, formula: "NH3" }));
  near(r.weak!.approx.pOH, 2.87, 0.006);
  near(r.weak!.approx.pH, 11.13, 0.006);
  near(r.pH, 11.12, 0.006);
});

test("تبدیل: pH = ۳ → [H+] = 1.0e-3", () => {
  const r = okr(convertPh({ from: "pH", value: 3 }));
  near(r.H / 1e-3, 1, 1e-12);
  near(r.pOH, 11);
  near(r.OH / 1e-11, 1, 1e-9);
});

test("تبدیل از pOH، [H+] و [OH-] و رقم فارسی", () => {
  near(okr(convertPh({ from: "pOH", value: "۴" })).pH, 10);
  near(okr(convertPh({ from: "H", value: "2.5×10^-4" })).pH, 3.602, 0.001);
  near(okr(convertPh({ from: "OH", value: 1e-7 })).pH, 7);
  assert.equal(okr(convertPh({ from: "OH", value: 1e-7 })).nature, "neutral");
  const w = okr(convertPh({ from: "pH", value: -0.5 }));
  assert.ok(w.warnings.length > 0);
});

test("Kw در ۲۵ درجه: [H+]·[OH-] = 1e-14", () => {
  for (const pH of [1, 4.5, 7, 9.3, 13]) {
    const r = okr(convertPh({ from: "pH", value: pH }));
    near((r.H * r.OH) / KW, 1, 1e-9);
    near(r.pH + r.pOH, 14, 1e-12);
  }
});

test("هشدار غلظت کمتر از 1e-6 و اصلاح با یونش آب", () => {
  const r = okr(strongAcid({ c: 1e-8, formula: "HCl" }));
  assert.ok(r.warnings.some((w) => /یونش آب/.test(w)));
  assert.ok(r.pH < 7, "اسید رقیق نباید pH بیشتر از ۷ بدهد");
  near(r.pH, 6.98, 0.01);
  const b = okr(strongBase({ c: 1e-8 }));
  assert.ok(b.pH > 7);
});

test("قرارداد H2SO4 برای تأیید استاد علامت می‌خورد", () => {
  const r = okr(strongAcid({ c: 0.005, n: 2, formula: "H2SO4" }));
  near(r.pH, 2);
  assert.ok(r.warnings.some((w) => /H2SO4/.test(w) && /استاد/.test(w)));
  assert.ok(PH_PRESETS.find((p) => p.formula === "H2SO4")!.teacherConfirm);
});

test("رقیق‌سازی C1V1 = C2V2", () => {
  const r = dilution({ c1: 0.1, v1: 50, v2: 500 });
  assert.ok(r.ok);
  if (r.ok) near(r.c2, 0.01, 1e-12);
  const v = dilution({ c1: 1, v1: 10, c2: 0.1 });
  assert.ok(v.ok);
  if (v.ok) near(v.v2, 100, 1e-9);
  assert.equal(dilution({ c1: 0.1, v1: 50, v2: 10 }).ok, false);
  assert.equal(dilution({ c1: 0.1, v1: 50 }).ok, false);
  assert.equal(dilution({ c1: 0.1, v1: 50, c2: 0.5 }).ok, false);
});

test("خطاهای ورودی pH", () => {
  for (const r of [
    strongAcid({ c: 0 }),
    strongAcid({ c: "abc" }),
    strongAcid({ c: 0.1, n: 0 }),
    strongBase({ c: -1 }),
    weakAcid({ c: 0.1, ka: 0 }),
    weakBase({ c: 0.1, kb: "x" }),
    convertPh({ from: "H", value: 0 }),
    convertPh({ from: "pH", value: 30 }),
  ]) {
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /[آ-ی]/);
  }
});
