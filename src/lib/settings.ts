import { db } from "./db";

export interface SiteContent {
  brand: string;
  teacherName: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  credentials: string[];
  highlights: { value: string; label: string }[];
  teacherPhoto: string;
  phone: string;
  telegram: string;
  bale: string;
  instagram: string;
  address: string;
  mapUrl: string;
  footerText: string;
}

export interface SmsSettings {
  provider: "mock" | "melipayamak-rest" | "melipayamak-console";
  username: string;
  password: string;
  apiKey: string;
  from: string;
  usePatterns: boolean;
  parentSms: boolean;
}

export interface ArvanSettings {
  apiKey: string;
  secureLink: boolean;
  bindIp: boolean;
  expireMinutes: number;
  watermark: boolean;
}

export interface PaymentSettings {
  enabled: boolean;
  merchantId: string;
  sandbox: boolean;
}

export interface PointSettings {
  examBase: number;
  examBonusMax: number;
  videoDone: number;
  videoPer5Min: number;
  onlinePer10Min: number;
  onlineDailyCap: number;
  daily: number;
  streak7: number;
}

export interface AccessSettings {
  studentsAllGrades: boolean;
  requireApproval: boolean;
}

export interface Settings {
  site: SiteContent;
  sms: SmsSettings;
  arvan: ArvanSettings;
  payment: PaymentSettings;
  points: PointSettings;
  access: AccessSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  site: {
    brand: "دوپینگ شیمی",
    teacherName: "جواد پرتویی",
    tagline: "شیمی رو بفهم، کنکور رو فتح کن",
    heroTitle: "شیمی، این بار با دوپینگ",
    heroSubtitle:
      "کلاس‌ها، همایش‌ها، ویدیوهای آموزشی و آزمون‌های هدفمند استاد جواد پرتویی؛ همه در یک اپلیکیشن، با گزارش لحظه‌به‌لحظه‌ی پیشرفتت.",
    aboutTitle: "چرا جواد پرتویی؟",
    aboutText:
      "شیمی رو باید فهمید، نه حفظ کرد. استاد جواد پرتویی با ترکیب تدریس مفهومی، تست‌زنی هدفمند و برنامه‌ریزی دقیق، شیمی رو از ترسناک‌ترین درس کنکور به نقطه‌ی قوت دانش‌آموزهاش تبدیل می‌کنه. کسی که خودش طراح سؤال آزمون‌های قلم‌چی و خیلی سبزه، دقیقاً می‌دونه طراح کنکور از تو چی می‌خواد؛ و نتیجه‌اش رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴ و بیش از ۲۰۰ رتبه‌ی زیر ۱۰۰۰ است.",
    credentials: [
      "لیسانس مهندسی شیمی از دانشگاه فردوسی مشهد",
      "عضو بنیاد ملی نخبگان کشور",
      "دبیر شیمی دبیرستان هاشمی‌نژاد ۱ مشهد",
      "مؤلف کتاب‌های دوپینگ شیمی",
      "طراح آزمون‌های قلم‌چی و خیلی سبز",
    ],
    highlights: [
      { value: "۱۰ · ۳۸ · ۱۰۸", label: "رتبه‌های کنکور ۱۴۰۴" },
      { value: "۵۳", label: "رتبه‌ی دورقمی (۱۴۰۱ تا ۱۴۰۳)" },
      { value: "+۲۰۰", label: "رتبه‌ی زیر ۱۰۰۰" },
    ],
    teacherPhoto: "/images/teacher.png",
    phone: "09158148172",
    telegram: "https://t.me/+989158148172",
    bale: "https://ble.ir/+989158148172",
    instagram: "",
    address: "مشهد",
    mapUrl: "",
    footerText: "تمامی حقوق برای دوپینگ شیمی محفوظ است.",
  },
  sms: { provider: "mock", username: "", password: "", apiKey: "", from: "", usePatterns: true, parentSms: true },
  arvan: { apiKey: "", secureLink: true, bindIp: false, expireMinutes: 180, watermark: true },
  payment: { enabled: false, merchantId: "", sandbox: true },
  points: { examBase: 20, examBonusMax: 30, videoDone: 10, videoPer5Min: 1, onlinePer10Min: 1, onlineDailyCap: 12, daily: 3, streak7: 25 },
  access: { studentsAllGrades: true, requireApproval: true },
};

type Key = keyof Settings;
let cache: { at: number; data: Settings } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.data;
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(DEFAULT_SETTINGS) } } });
  const data = structuredClone(DEFAULT_SETTINGS) as Settings;
  for (const r of rows) {
    const k = r.key as Key;
    if (r.value && typeof r.value === "object") Object.assign(data[k] as object, r.value as object);
  }
  cache = { at: Date.now(), data };
  return data;
}

export async function getSetting<K extends Key>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

export async function saveSetting<K extends Key>(key: K, value: Partial<Settings[K]>) {
  const current = await getSetting(key);
  const merged = { ...current, ...value };
  await db.setting.upsert({ where: { key }, create: { key, value: merged as object }, update: { value: merged as object } });
  cache = null;
  return merged;
}

/** مقدار خام (مثل کلید امضا) */
export async function getRaw(key: string): Promise<unknown> {
  const r = await db.setting.findUnique({ where: { key } });
  return r?.value ?? null;
}
export async function setRaw(key: string, value: unknown) {
  await db.setting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
}
