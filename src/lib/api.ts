import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getUser, isAdmin, type SessionUser } from "./auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * پاسخ‌های API مخصوص هر کاربرند (لینک امن ویدیو، اطلاعات حساب)؛
 * نه CDN آروان و نه service worker نباید آن‌ها را کش کنند.
 * هدرهای فرستاده‌شده‌ی صدا زننده بر این پیش‌فرض‌ها مقدم‌اند.
 */
function noStore(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "private, no-store, max-age=0");
  const vary = headers.get("Vary");
  if (!vary) headers.set("Vary", "Cookie");
  else if (!/(^|,)\s*(cookie|\*)\s*(,|$)/i.test(vary)) headers.set("Vary", `${vary}, Cookie`);
  return { ...init, headers };
}

export const ok = (data: unknown = { ok: true }, init?: ResponseInit) => NextResponse.json(data, noStore(init));
export const fail = (status: number, error: string, init?: ResponseInit) => NextResponse.json({ error }, noStore({ ...init, status }));

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** یک route handler را با مدیریت خطا می‌پوشاند */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error(e);
      return fail(500, "خطای داخلی سرور");
    }
  };
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const raw = await req.json().catch(() => null);
  const r = schema.safeParse(raw);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, first?.message && !first.message.startsWith("Invalid") ? first.message : "اطلاعات ارسالی نامعتبر است");
  }
  return r.data;
}

export async function mustUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new HttpError(401, "ابتدا وارد شوید");
  return u;
}

export async function mustAdmin(): Promise<SessionUser> {
  const u = await mustUser();
  if (!isAdmin(u)) throw new HttpError(403, "دسترسی ندارید");
  return u;
}

export function clientIp(req: Request) {
  const h = req.headers;
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "").trim() || undefined;
}
