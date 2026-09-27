import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, ok, route } from "@/lib/api";
import { createSession, hashOtp, isAdmin } from "@/lib/auth";
import { normalizePhone, toEnDigits } from "@/lib/utils";

export const POST = route(async (req) => {
  const b = await body(req, z.object({ phone: z.string(), code: z.string() }));
  const phone = normalizePhone(b.phone);
  const code = toEnDigits(b.code).trim();
  if (!phone) throw new HttpError(400, "شماره موبایل معتبر نیست");
  const otp = await db.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) throw new HttpError(400, "کد منقضی شده است؛ دوباره درخواست دهید");
  if (otp.attempts >= 5) throw new HttpError(429, "تعداد تلاش‌ها زیاد بود؛ کد جدید بگیرید");
  if (otp.codeHash !== hashOtp(phone, code)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "کد وارد شده صحیح نیست");
  }
  await db.otpCode.deleteMany({ where: { phone } });
  let user = await db.user.findUnique({ where: { phone } });
  if (!user) user = await db.user.create({ data: { phone } });
  if (user.blocked) throw new HttpError(403, "حساب شما مسدود شده است");
  await createSession(user.id);
  return ok({ ok: true, next: isAdmin(user) ? "/admin" : user.profileDone ? "/panel" : "/register" });
});
