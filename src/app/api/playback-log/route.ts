import { z } from "zod";
import { fail, HttpError, mustUser, ok, route } from "@/lib/api";
import { admitEvents, logTelemetryError, storePlaybackEvents } from "@/lib/playback-store";

/**
 * گزارش رخدادهای پخش ویدیو از مرورگر (src/lib/playback-log.ts) — فقط کاربر واردشده.
 * 2xx = ذخیره شد؛ 4xx = کلاینت دور می‌ریزد؛ 5xx = کلاینت صف می‌کند و بعداً دوباره می‌فرستد.
 * سهمیه‌ی هر کاربر: ۶۰ رخداد عادی + ۳۰ رخداد پایانی در ساعت (playback-store.ts).
 */
const MAX_BODY = 64_000;

// null هم پذیرفته می‌شود: JSON.stringify(NaN) در مرورگر null می‌شود و نباید کل دسته رد شود
const num = z.number().nullish();
const str = (max: number) => z.string().max(max).nullish();

const event = z.object({
  kind: z.string().regex(/^[a-z0-9-]{1,40}$/),
  sessionId: z.string().min(1).max(40),
  videoId: str(40),
  engine: str(10),
  build: str(20),
  position: num,
  sinceLoadSec: num,
  code: num,
  detail: str(1000), // بیش از ۳۰۰ نویسه هنگام ذخیره کوتاه می‌شود
  fatal: z.boolean().nullish(),
  ctx: z.record(z.string(), z.unknown()).nullish(),
  queued: z.boolean().nullish(),
  at: num,
  eid: z.string().regex(/^[A-Za-z0-9-]{8,40}$/).nullish(), // شناسه‌ی یکتای رخداد از مرورگر (ارسال دوباره‌ی صف تکراری ذخیره نشود)
});
const schema = z.object({ events: z.array(event).min(1).max(20), build: str(20) });

export const POST = route(async (req) => {
  let user;
  try {
    user = await mustUser();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    logTelemetryError(e); // پایگاه داده در دسترس نیست: بدون لاگ پشت‌سرهم، کلاینت بعداً دوباره می‌فرستد
    return fail(503, "سرور موقتاً در دسترس نیست");
  }

  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return fail(413, "گزارش بیش از حد بزرگ است");
  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY) return fail(413, "گزارش بیش از حد بزرگ است");
  let raw: unknown = null;
  try {
    raw = JSON.parse(text);
  } catch {
    /* پایین‌تر ۴۰۰ می‌شود */
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail(400, "گزارش نامعتبر است");
  const { events, build } = parsed.data;

  const { admitted, release } = admitEvents(user.id, events);
  if (!admitted.length) return fail(429, "تعداد گزارش‌ها از سهمیه‌ی ساعتی بیشتر شد");

  // نسخه‌ی کد مرورگر: روی خود رخداد، روی دسته، یا داخل ctx
  const withBuild = admitted.map((e) => ({ ...e, build: e.build || build || (typeof e.ctx?.build === "string" ? e.ctx.build.slice(0, 20) : null) }));
  if (!(await storePlaybackEvents(user.id, req, withBuild))) {
    release();
    return fail(503, "ذخیره‌ی گزارش ممکن نشد");
  }
  return ok({ ok: true, stored: admitted.length, dropped: events.length - admitted.length });
});
