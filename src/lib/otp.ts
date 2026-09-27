import "server-only";
import { db } from "./db";
import { HttpError } from "./api";
import { hashOtp } from "./auth";
import { toEnDigits } from "./utils";

/** بررسی کد پیامکی؛ در صورت درستی کدها پاک می‌شوند */
export async function consumeOtp(phone: string, rawCode: string) {
  const code = toEnDigits(rawCode).trim();
  const otp = await db.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) throw new HttpError(400, "کد منقضی شده است؛ دوباره درخواست دهید");
  if (otp.attempts >= 5) throw new HttpError(429, "تعداد تلاش‌ها زیاد بود؛ کد جدید بگیرید");
  if (otp.codeHash !== hashOtp(phone, code)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "کد وارد شده صحیح نیست");
  }
  await db.otpCode.deleteMany({ where: { phone } });
}

/** محدودیت تلاش ورود با رمز (در حافظه): ۸ تلاش ناموفق در ۱۵ دقیقه برای هر شماره یا IP */
const fails = new Map<string, number[]>();
export function checkLoginLimit(keys: string[]) {
  const now = Date.now();
  for (const k of keys) {
    const list = (fails.get(k) ?? []).filter((t) => now - t < 15 * 60_000);
    fails.set(k, list);
    if (list.length >= 8) throw new HttpError(429, "تلاش ناموفق زیاد بود؛ ۱۵ دقیقه بعد یا با «فراموشی رمز» وارد شوید");
  }
}
export function recordLoginFail(keys: string[]) {
  for (const k of keys) fails.set(k, [...(fails.get(k) ?? []), Date.now()]);
}
