/**
 * یکسان‌سازی ورودی کاربر برای کتابخانه‌ی شیمی (خالص و ایزومورفیک؛ بدون وابستگی).
 *
 * - رقم فارسی/عربی → لاتین؛ «٫» → نقطه‌ی اعشار
 * - زیروند/بالانویس یونیکد (₂، ²⁻) → نحو ساده (2، ^2-)
 * - انواع خط تیره و منفی → «-»؛ نویسه‌های نامرئی (نیم‌فاصله، LRM/RLM) حذف
 * - جداکننده‌ی آب تبلور (· • ∙ ⋅ * و «.» بین دو بخش فرمول) → «·»
 * - پیکان‌ها: → ⟶ -> --> => = (یک‌طرفه) و ⇌ ⇄ <=> <-> (تعادلی)
 */
import { ChemError, ltr } from "./common";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const SUB_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** رقم فارسی و عربی → لاتین؛ «٫» → «.» و «٬» (جداکننده‌ی هزارگان) حذف */
export function toAsciiDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/٫/g, ".")
    .replace(/٬/g, "");
}

/** حذف نویسه‌های نامرئی جهت‌دهی و اتصال که از متن فارسی کپی می‌شوند */
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;

/**
 * یکسان‌سازی متن فرمول یا معادله (بدون تفسیر شیمیایی).
 * بالانویس‌های پشت سر هم یک گروه «^…» می‌شوند: «SO₄²⁻» → «SO4^2-».
 */
export function normalizeChemText(input: string): string {
  let s = toAsciiDigits(input)
    .replace(INVISIBLE, "")
    .replace(/ /g, " ")
    .replace(/＋/g, "+")
    .replace(/[−‐‑‒–—－]/g, "-")
    .replace(/[₀-₉]/g, (d) => String(SUB_DIGITS.indexOf(d)));
  // گروه بالانویس یونیکد → ^…
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (m) => {
    const v = m.replace(/[⁰-⁹¹²³]/g, (d) => String(SUP_DIGITS.indexOf(d))).replace(/⁺/g, "+").replace(/⁻/g, "-");
    return `^${v}`;
  });
  // جداکننده‌ی آب تبلور
  s = s.replace(/[•∙⋅*]/g, "·");
  // «.» فقط وقتی جداکننده است که بعد از عنصر/عدد/پرانتز و پیش از عدد، حرف بزرگ یا پرانتز بیاید
  s = s.replace(/([A-Za-z0-9)\]])\.(?=[0-9A-Z(\[])/g, "$1·");
  // نقطه‌ی پایان جمله
  s = s.replace(/\.\s*$/, "");
  return s.replace(/\s+/g, " ").trim();
}

export type ArrowKind = "→" | "⇌";

const EQ_ARROW = /<-+>|<=+>|⇌|⇄|⟷|↔/g;
const FWD_ARROW = /-+>|=+>|→|⟶|⟹|⇒|=+/g;

/**
 * جدا کردن دو سمت معادله.
 * خطا: بدون پیکان، بیش از یک پیکان، یا سمت خالی.
 */
export function splitEquation(input: string): { left: string; right: string; arrow: ArrowKind } {
  const s = normalizeChemText(input);
  if (!s) throw new ChemError("معادله‌ای وارد نشده است.", "empty");
  // پیکان تعادلی را اول جایگزین می‌کنیم تا «<=>» با «=» یک‌طرفه اشتباه نشود
  const marked = s.replace(EQ_ARROW, "\u0001").replace(FWD_ARROW, "\u0002");
  const arrows = (marked.match(/[\u0001\u0002]/g) ?? []).length;
  if (arrows === 0) throw new ChemError(`پیکان واکنش پیدا نشد؛ دو سمت را با «${ltr("->")}» یا «=» از هم جدا کنید.`, "no-arrow");
  if (arrows > 1) throw new ChemError("معادله باید فقط یک پیکان داشته باشد.", "multi-arrow");
  const idx = marked.search(/[\u0001\u0002]/);
  const arrow: ArrowKind = marked[idx] === "\u0001" ? "⇌" : "→";
  const left = marked.slice(0, idx).trim();
  const right = marked.slice(idx + 1).trim();
  if (!left) throw new ChemError("سمت واکنش‌دهنده‌ها خالی است.", "empty-side");
  if (!right) throw new ChemError("سمت فراورده‌ها خالی است.", "empty-side");
  return { left, right, arrow };
}

/** گروه بالانویس: ^2-، ^{3+}، ^+، ^-2، ^2 (علامت دوم را نمی‌بلعد: H^++OH^- دو گونه است) */
export const CARET_GROUP = /^\^(\{[^}]*\}|\d+[+-]|[+-]\d*|\d+)?/;

/** آغاز یک گونه‌ی تازه پس از «+» جداکننده */
const SPECIES_START = /^[A-Z0-9(\[{e]/;

/**
 * جدا کردن گونه‌های یک سمت معادله با «+».
 * «+» چسبیده به انتهای گونه (Na+، NH4++OH-) بار است، نه جداکننده.
 */
export function splitSpecies(side: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  const s = side;
  while (i < s.length) {
    const ch = s[i];
    // گروه بالانویس کامل را کپی می‌کنیم: ^2-، ^{3+}، ^+
    if (ch === "^") {
      const m = CARET_GROUP.exec(s.slice(i))!;
      cur += m[0];
      i += m[0].length;
      continue;
    }
    if (ch === "+") {
      const before = s[i - 1] ?? "";
      const after = s.slice(i + 1);
      const spaceBefore = /\s/.test(before) || cur.trim() === "";
      let isCharge = false;
      if (!spaceBefore) {
        if (after === "" || /^\s/.test(after) || /^\((s|l|g|aq)\)/.test(after) || after.startsWith("+")) isCharge = true;
        else if (!SPECIES_START.test(after)) isCharge = true;
      }
      if (isCharge) {
        cur += ch;
      } else {
        out.push(cur.trim());
        cur = "";
      }
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  out.push(cur.trim());
  return out;
}

/**
 * عدد ورودی کاربر → number (یا null اگر نامعتبر).
 * پشتیبانی: رقم فارسی، «٫»، «1.8e-5»، «1.8×10^-5»، «1.8*10^-5»، «1.8 x 10⁻⁵»، «10^-3».
 */
export function parseNumberInput(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;
  let s = toAsciiDigits(String(raw))
    .replace(INVISIBLE, "")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "");
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (m) => "^" + m.replace(/[⁰-⁹¹²³]/g, (d) => String(SUP_DIGITS.indexOf(d))).replace(/⁻/g, "-").replace(/⁺/g, ""));
  if (s.includes(",")) s = s.includes(".") ? s.replace(/,/g, "") : s.replace(/,/g, ".");
  if (!s) return null;
  // a×10^b
  const m = /^(?:([+-]?(?:\d+\.?\d*|\.\d+))[×xX*·])?10\^\{?([+-]?\d+)\}?$/.exec(s);
  if (m) {
    const a = m[1] === undefined ? 1 : Number(m[1]);
    const v = a * 10 ** Number(m[2]);
    return Number.isFinite(v) ? v : null;
  }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
