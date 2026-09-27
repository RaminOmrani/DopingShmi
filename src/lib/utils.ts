import { clsx, type ClassValue } from "clsx";

export const cn = (...c: ClassValue[]) => clsx(c);

const FA = "۰۱۲۳۴۵۶۷۸۹";
export const faNum = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "" : String(v).replace(/\d/g, (d) => FA[Number(d)]);

export const toEnDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export const fmtInt = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.round(n));
export const fmtToman = (n: number) => `${fmtInt(n)} تومان`;
export const fmtPct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${faNum(Math.round(n * 10) / 10)}٪`);

/** ۰۹۱۲۳۴۵۶۷۸۹ → 09123456789 ؛ نامعتبر → null */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let p = toEnDigits(String(input)).replace(/[^\d+]/g, "");
  if (p.startsWith("+98")) p = "0" + p.slice(3);
  else if (p.startsWith("0098")) p = "0" + p.slice(4);
  else if (p.startsWith("98") && p.length === 12) p = "0" + p.slice(2);
  else if (p.startsWith("9") && p.length === 10) p = "0" + p;
  return /^09\d{9}$/.test(p) ? p : null;
}

const TZ = "Asia/Tehran";
/** روز جاری به وقت تهران به‌صورت YYYY-MM-DD */
export const tehranDay = (d: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const addDays = (day: string, n: number) => {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const fmtDate = (d: Date | string | null | undefined, withTime = false) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};

export const fmtDayShort = (day: string) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(day + "T12:00:00Z"));

export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${faNum(h)} ساعت${m ? ` و ${faNum(m)} دقیقه` : ""}`;
  if (m) return `${faNum(m)} دقیقه`;
  return `${faNum(Math.max(0, Math.round(sec)))} ثانیه`;
};

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return faNum(h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`);
};

export const maskPhone = (p: string) => `${p.slice(0, 4)}***${p.slice(-4)}`;
