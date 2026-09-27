import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, mustUser, ok, route } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";

/** تعیین یا تغییر رمز از پروفایل */
export const POST = route(async (req) => {
  const user = await mustUser();
  const b = await body(req, z.object({ current: z.string().optional().default(""), password: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر باشد").max(64) }));
  if (user.passwordHash && !verifyPassword(b.current, user.passwordHash)) throw new HttpError(400, "رمز فعلی اشتباه است");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(b.password) } });
  return ok({ ok: true });
});
