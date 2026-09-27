import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, ok, route } from "@/lib/api";
import { createSession, hashPassword, isAdmin } from "@/lib/auth";
import { consumeOtp } from "@/lib/otp";
import { normalizePhone } from "@/lib/utils";

/** بازیابی رمز: کد پیامکی + رمز جدید */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ phone: z.string(), code: z.string(), password: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر باشد").max(64) }));
  const phone = normalizePhone(b.phone);
  if (!phone) throw new HttpError(400, "شماره موبایل معتبر نیست");
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) throw new HttpError(404, "حسابی با این شماره پیدا نشد؛ ثبت‌نام کنید");
  await consumeOtp(phone, b.code);
  if (user.blocked) throw new HttpError(403, "حساب شما مسدود شده است");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(b.password) } });
  await createSession(user.id);
  return ok({ ok: true, next: isAdmin(user) ? "/admin" : user.profileDone ? "/panel" : "/register" });
});
