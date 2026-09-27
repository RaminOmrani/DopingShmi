import { z } from "zod";
import { db } from "@/lib/db";
import { body, clientIp, HttpError, ok, route } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { checkLoginLimit, recordLoginFail } from "@/lib/otp";
import { normalizePhone } from "@/lib/utils";

/** ثبت‌نام با شماره و رمز (بدون پیامک) */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ phone: z.string(), password: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر باشد").max(64) }));
  const phone = normalizePhone(b.phone);
  if (!phone) throw new HttpError(400, "شماره موبایل معتبر نیست");
  const keys = [`reg:${clientIp(req) ?? "?"}`];
  checkLoginLimit(keys);
  recordLoginFail(keys); // سقف ۸ ثبت‌نام در ۱۵ دقیقه برای هر IP
  const exists = await db.user.findUnique({ where: { phone } });
  if (exists) throw new HttpError(409, "این شماره قبلاً ثبت شده است؛ وارد شوید یا از «فراموشی رمز» استفاده کنید");
  const user = await db.user.create({ data: { phone, passwordHash: hashPassword(b.password) } });
  await createSession(user.id);
  return ok({ ok: true, next: "/register" });
});
