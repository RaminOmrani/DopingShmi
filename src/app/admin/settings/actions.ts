"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { adminAction, bool, must, num, str } from "@/lib/action";
import { getUser, hashPassword, verifyPassword } from "@/lib/auth";
import { saveSetting, getSetting } from "@/lib/settings";
import { sendTemplate, smsCredit } from "@/lib/sms";
import { arvanChannels } from "@/lib/arvan";
import { normalizePhone } from "@/lib/utils";

export const saveContent = adminAction(async (fd) => {
  const lines = (k: string) => str(fd, k).split("\n").map((l) => l.trim()).filter(Boolean);
  await saveSetting("site", {
    brand: str(fd, "brand"),
    teacherName: str(fd, "teacherName"),
    tagline: str(fd, "tagline"),
    heroTitle: str(fd, "heroTitle"),
    heroSubtitle: str(fd, "heroSubtitle"),
    aboutTitle: str(fd, "aboutTitle"),
    aboutText: str(fd, "aboutText"),
    credentials: lines("credentials"),
    highlights: lines("highlights").map((l) => {
      const [value, ...label] = l.split("|");
      return { value: value.trim(), label: label.join("|").trim() };
    }),
    phone: str(fd, "phone"),
    telegram: str(fd, "telegram"),
    bale: str(fd, "bale"),
    instagram: str(fd, "instagram"),
    address: str(fd, "address"),
    mapUrl: str(fd, "mapUrl"),
    footerText: str(fd, "footerText"),
  });
  revalidatePath("/", "layout");
  return { ok: true };
});

export const saveSms = adminAction(async (fd) => {
  const cur = await getSetting("sms");
  await saveSetting("sms", {
    provider: (str(fd, "provider") as never) || "mock",
    username: str(fd, "username"),
    password: str(fd, "password") || cur.password,
    apiKey: str(fd, "apiKey") || cur.apiKey,
    from: str(fd, "from"),
    usePatterns: bool(fd, "usePatterns"),
    parentSms: bool(fd, "parentSms"),
  });
  const c = await smsCredit();
  return { ok: true, message: c.ok ? `ذخیره شد · اعتبار پنل: ${c.credit}` : `ذخیره شد · بررسی اعتبار ناموفق: ${c.error}` };
});

export const testSms = adminAction(async (fd) => {
  const phone = normalizePhone(str(fd, "phone"));
  must(phone, "شماره معتبر نیست");
  const r = await sendTemplate("otp", phone, { code: "12345", minutes: 3 });
  return r.ok ? { ok: true, message: "پیامک آزمایشی (الگوی کد ورود) ارسال شد" } : { error: `ناموفق: ${r.error}` };
});

export const saveArvan = adminAction(async (fd) => {
  const cur = await getSetting("arvan");
  await saveSetting("arvan", { apiKey: str(fd, "apiKey") || cur.apiKey, secureLink: bool(fd, "secureLink"), bindIp: bool(fd, "bindIp"), watermark: bool(fd, "watermark"), expireMinutes: Math.max(10, num(fd, "expireMinutes", 180)) });
  try {
    const ch = await arvanChannels();
    return { ok: true, message: `اتصال برقرار است · ${ch.length} کانال: ${ch.map((c) => c.title).join("، ")}` };
  } catch (e) {
    return { ok: true, message: `ذخیره شد ولی اتصال به آروان برقرار نشد: ${(e as Error).message}` };
  }
});

export const savePayment = adminAction(async (fd) => {
  await saveSetting("payment", { enabled: bool(fd, "enabled"), merchantId: str(fd, "merchantId"), sandbox: bool(fd, "sandbox") });
  return { ok: true };
});

export const savePoints = adminAction(async (fd) => {
  const keys = ["examBase", "examBonusMax", "videoDone", "videoPer5Min", "onlinePer10Min", "onlineDailyCap", "daily", "streak7"] as const;
  await saveSetting("points", Object.fromEntries(keys.map((k) => [k, Math.max(0, Math.round(num(fd, k)))])));
  return { ok: true };
});

export const saveAccess = adminAction(async (fd) => {
  await saveSetting("access", { studentsAllGrades: bool(fd, "studentsAllGrades"), requireApproval: true });
  return { ok: true };
});

export const changePassword = adminAction(async (fd) => {
  const u = (await getUser())!;
  const cur = str(fd, "current");
  const next = str(fd, "next");
  must(next.length >= 8, "رمز جدید حداقل ۸ کاراکتر باشد");
  must(!u.passwordHash || verifyPassword(cur, u.passwordHash), "رمز فعلی اشتباه است");
  await db.user.update({ where: { id: u.id }, data: { passwordHash: hashPassword(next) } });
  return { ok: true, message: "رمز عبور تغییر کرد" };
});
