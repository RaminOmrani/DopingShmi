/** آزمون داده‌ی عنصرها (اجرا: pnpm test:chem) */
import test from "node:test";
import assert from "node:assert/strict";
import {
  aufbauSubshells,
  configPlain,
  electronCount,
  elementBySymbol,
  elementByZ,
  ELEMENTS,
  findElement,
  fullConfig,
  fullSubshells,
  valenceElectrons,
} from "./elements";
import { ATOMIC_MASS } from "./masses";
import { ELEMENTS as LEVEL_ELEMENTS } from "../constants";

const el = (s: string) => elementBySymbol(s)!;

test("۱۱۸ عنصر یکتا به ترتیب عدد اتمی", () => {
  assert.equal(ELEMENTS.length, 118);
  assert.equal(new Set(ELEMENTS.map((e) => e.symbol)).size, 118);
  assert.equal(new Set(ELEMENTS.map((e) => e.fa)).size, 118);
  ELEMENTS.forEach((e, i) => assert.equal(e.z, i + 1));
  assert.equal(Object.keys(ATOMIC_MASS).length, 118);
  for (const e of ELEMENTS) assert.ok(ATOMIC_MASS[e.symbol] > 0, e.symbol);
});

test("نام فارسی ۷۹ عنصر اول عیناً برابر constants.ts", () => {
  assert.equal(LEVEL_ELEMENTS.length, 79);
  LEVEL_ELEMENTS.forEach(([sym, fa], i) => {
    assert.equal(ELEMENTS[i].symbol, sym);
    assert.equal(ELEMENTS[i].fa, fa);
  });
  assert.equal(el("Hg").fa, "جیوه");
  assert.equal(el("U").fa, "اورانیم");
  assert.equal(el("Og").fa, "اوگانسون");
});

test("فقط ی و ک فارسی در نام‌ها", () => {
  for (const e of ELEMENTS) assert.doesNotMatch(e.fa, /[\u0643\u064a]/, e.symbol);
});

test("جرم‌های کلیدی", () => {
  assert.equal(el("Fe").mass, 55.845);
  assert.equal(el("Cl").mass, 35.45);
  assert.equal(el("H").mass, 1.008);
  assert.equal(el("C").mass, 12.011);
  assert.equal(el("O").mass, 15.999);
  assert.equal(el("Cu").mass, 63.546);
  assert.equal(el("Tc").massText, "[98]");
  assert.equal(el("Tc").radioactive, true);
  assert.equal(el("U").massNumberOnly, false);
  assert.equal(el("U").radioactive, true);
  assert.equal(el("Bi").radioactive, false);
});

test("آرایش Cr و Cu (استثنا) و Fe", () => {
  assert.equal(el("Cr").config, "[Ar] 3d5 4s1");
  assert.equal(el("Cu").config, "[Ar] 3d10 4s1");
  assert.equal(fullConfig(24), "1s2 2s2 2p6 3s2 3p6 3d5 4s1");
  assert.equal(fullConfig(29), "1s2 2s2 2p6 3s2 3p6 3d10 4s1");
  assert.equal(fullConfig(26), "1s2 2s2 2p6 3s2 3p6 3d6 4s2");
  assert.equal(fullConfig(26, "aufbau"), "1s2 2s2 2p6 3s2 3p6 4s2 3d6");
  assert.equal(configPlain("[Ar] 3d6 4s2"), "[Ar] 3d⁶ 4s²");
});

test("آرایش ثبت‌شده برای Z ≤ ۳۶ با قاعده‌ی آفبا می‌خواند (جز Cr و Cu)", () => {
  const key = (s: { n: number; l: string; e: number }[]) =>
    s
      .map((x) => `${x.n}${x.l}${x.e}`)
      .sort()
      .join(" ");
  for (let z = 1; z <= 36; z++) {
    if (z === 24 || z === 29) {
      assert.notEqual(key(fullSubshells(z)), key(aufbauSubshells(z)));
      continue;
    }
    assert.equal(key(fullSubshells(z)), key(aufbauSubshells(z)), elementByZ(z).symbol);
  }
});

test("مجموع الکترون‌های آرایش هر عنصر برابر عدد اتمی است", () => {
  for (const e of ELEMENTS) assert.equal(electronCount(e), e.z, e.symbol);
});

test("دوره، گروه و دسته", () => {
  assert.deepEqual([el("H").period, el("H").group, el("H").block], [1, 1, "s"]);
  assert.deepEqual([el("He").group, el("He").block], [18, "s"]);
  assert.deepEqual([el("Fe").period, el("Fe").group, el("Fe").block], [4, 8, "d"]);
  assert.deepEqual([el("Hf").period, el("Hf").group], [6, 4]);
  assert.deepEqual([el("Rn").group, el("Og").group, el("Rf").group], [18, 18, 4]);
  assert.deepEqual([el("Ce").group, el("Ce").block], [null, "f"]);
  assert.equal(el("Al").group, 13);
  assert.equal(el("Br").period, 4);
  assert.equal(ELEMENTS.filter((e) => e.group === null).length, 30);
  for (let g = 1; g <= 18; g++) assert.ok(ELEMENTS.some((e) => e.group === g), String(g));
});

test("دسته‌بندی شیمیایی", () => {
  assert.equal(el("Na").category, "alkali");
  assert.equal(el("H").category, "nonmetal");
  assert.equal(el("Ca").category, "alkaline-earth");
  assert.equal(el("Zn").category, "transition");
  assert.equal(el("La").category, "lanthanide");
  assert.equal(el("U").category, "actinide");
  assert.equal(el("Si").category, "metalloid");
  assert.equal(el("Cl").category, "halogen");
  assert.equal(el("Ar").category, "noble-gas");
  assert.equal(el("Pb").category, "post-transition");
});

test("حالت فیزیکی در ۲۵ درجه", () => {
  assert.equal(el("Br").phase, "liquid");
  assert.equal(el("Hg").phase, "liquid");
  assert.equal(el("Ga").phase, "solid");
  assert.equal(el("Cl").phase, "gas");
  assert.equal(el("Og").phase, "unknown");
  assert.equal(ELEMENTS.filter((e) => e.phase === "gas").length, 11);
});

test("الکترونگاتیوی و یون‌های رایج", () => {
  assert.equal(el("F").electronegativity, 3.98);
  assert.equal(el("O").electronegativity, 3.44);
  assert.equal(el("Ne").electronegativity, null);
  assert.deepEqual(el("Al").ions, [3]);
  assert.deepEqual(el("O").ions, [-2]);
  assert.deepEqual(el("Fe").ions, []); // فقط عنصرهای اصلی
  for (const e of ELEMENTS) if (e.ions.length) assert.ok(e.block === "s" || e.block === "p", e.symbol);
});

test("الکترون ظرفیت و جست‌وجو", () => {
  assert.equal(valenceElectrons(el("O")), 6);
  assert.equal(valenceElectrons(el("Mg")), 2);
  assert.equal(valenceElectrons(el("He")), 2);
  assert.equal(valenceElectrons(el("Fe")), null);
  assert.equal(findElement("fe")!.symbol, "Fe");
  assert.equal(findElement("آهن")!.symbol, "Fe");
  assert.equal(findElement("Iron")!.symbol, "Fe");
  assert.equal(findElement("۲۶")!.symbol, "Fe");
  assert.equal(findElement("\u0643ربن")!.symbol, "C"); // ک عربی در ورودی
  assert.equal(findElement("ناموجود"), undefined);
});
