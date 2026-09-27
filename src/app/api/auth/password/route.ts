import { z } from "zod";
import { db } from "@/lib/db";
import { body, clientIp, HttpError, ok, route } from "@/lib/api";
import { createSession, isAdmin, verifyPassword } from "@/lib/auth";
import { checkLoginLimit, recordLoginFail } from "@/lib/otp";
import { normalizePhone } from "@/lib/utils";

/** ورود با شماره موبایل و رمز عبور (دانش‌آموز و مدیر) */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ phone: z.string(), password: z.string().min(1) }));
  const phone = normalizePhone(b.phone);
  if (!phone) throw new HttpError(400, "شماره موبایل معتبر نیست");
  const keys = [`p:${phone}`, `ip:${clientIp(req) ?? "?"}`];
  checkLoginLimit(keys);
  const user = await db.user.findUnique({ where: { phone } });
  await new Promise((r) => setTimeout(r, 350));
  if (user && !user.passwordHash) throw new HttpError(400, "برای این حساب هنوز رمزی تعیین نشده؛ از «فراموشی رمز» یا ورود با کد پیامکی استفاده کنید");
  if (!user || !verifyPassword(b.password, user.passwordHash)) {
    recordLoginFail(keys);
    throw new HttpError(401, "شماره یا رمز عبور اشتباه است");
  }
  if (user.blocked) throw new HttpError(403, "حساب شما مسدود شده است");
  await createSession(user.id);
  return ok({ ok: true, next: isAdmin(user) ? "/admin" : user.profileDone ? "/panel" : "/register" });
});
