import { z } from "zod";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { body, clientIp, HttpError, ok, route } from "@/lib/api";
import { hashOtp } from "@/lib/auth";
import { sendTemplate } from "@/lib/sms";
import { getSetting } from "@/lib/settings";
import { normalizePhone } from "@/lib/utils";

const ipHits = new Map<string, number[]>();

export const POST = route(async (req) => {
  const { phone: raw } = await body(req, z.object({ phone: z.string() }));
  const phone = normalizePhone(raw);
  if (!phone) throw new HttpError(400, "شماره موبایل معتبر نیست");

  const ip = clientIp(req) ?? "?";
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (hits.length >= 12) throw new HttpError(429, "تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید");
  ipHits.set(ip, [...hits, now]);

  const recent = await db.otpCode.findMany({ where: { phone, createdAt: { gt: new Date(now - 3600_000) } }, orderBy: { createdAt: "desc" } });
  if (recent[0] && now - recent[0].createdAt.getTime() < 90_000) {
    const wait = Math.ceil((90_000 - (now - recent[0].createdAt.getTime())) / 1000);
    throw new HttpError(429, `برای ارسال دوباره ${wait} ثانیه صبر کنید`);
  }
  if (recent.length >= 5) throw new HttpError(429, "سقف ارسال کد در یک ساعت پر شده است");

  const user = await db.user.findUnique({ where: { phone }, select: { blocked: true } });
  if (user?.blocked) throw new HttpError(403, "حساب شما مسدود شده است");

  const code = String(randomInt(10000, 100000));
  await db.otpCode.create({ data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(now + 3 * 60_000) } });
  const res = await sendTemplate("otp", phone, { code, minutes: 3 });
  const sms = await getSetting("sms");
  if (!res.ok && sms.provider !== "mock") throw new HttpError(502, `ارسال پیامک ناموفق بود: ${res.error ?? ""}`);
  return ok({ ok: true, ...(sms.provider === "mock" && process.env.NODE_ENV !== "production" ? { devCode: code } : {}) });
});
