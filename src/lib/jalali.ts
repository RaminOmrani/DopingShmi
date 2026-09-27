import { toGregorian, toJalaali } from "jalaali-js";
import { toEnDigits } from "./utils";

/** «۱۴۰۵/۰۷/۱۰ ۱۶:۳۰» (وقت تهران) → Date */
export function parseJalali(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = toEnDigits(input).trim();
  const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const { gy, gm, gd } = toGregorian(+m[1], +m[2], +m[3]);
  const h = m[4] ? +m[4] : 0;
  const min = m[5] ? +m[5] : 0;
  return new Date(Date.UTC(gy, gm - 1, gd, h, min) - 3.5 * 3600_000);
}

/** Date → «1405/07/10 16:30» برای مقدار پیش‌فرض فرم‌ها */
export function toJalaliInput(d: Date | null | undefined) {
  if (!d) return "";
  const t = new Date(d.getTime() + 3.5 * 3600_000);
  const j = toJalaali(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  const p = (n: number) => String(n).padStart(2, "0");
  return `${j.jy}/${p(j.jm)}/${p(j.jd)} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}
