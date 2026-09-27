import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, ok, route } from "@/lib/api";
import { createSession, isAdmin, verifyPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";

/** ورود مدیر با رمز عبور */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ phone: z.string(), password: z.string().min(1) }));
  const phone = normalizePhone(b.phone);
  const user = phone ? await db.user.findUnique({ where: { phone } }) : null;
  await new Promise((r) => setTimeout(r, 400));
  if (!user || !isAdmin(user) || user.blocked || !verifyPassword(b.password, user.passwordHash)) throw new HttpError(401, "شماره یا رمز عبور اشتباه است");
  await createSession(user.id);
  return ok({ ok: true, next: "/admin" });
});
