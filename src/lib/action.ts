import "server-only";
import { getUser, isAdmin } from "./auth";

export type Result = { ok?: boolean; error?: string; message?: string; data?: unknown } | null;

export class ActionError extends Error {}

/** پوشش server action مدیر: بررسی دسترسی + تبدیل خطا به پیام */
export function adminAction(fn: (fd: FormData) => Promise<Result | void>) {
  return async (_prev: Result, fd: FormData): Promise<Result> => {
    const u = await getUser();
    if (!isAdmin(u)) return { error: "دسترسی ندارید" };
    try {
      return (await fn(fd)) ?? { ok: true };
    } catch (e) {
      if (e instanceof ActionError) return { error: e.message };
      console.error(e);
      return { error: "خطا در انجام عملیات" };
    }
  };
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const num = (fd: FormData, k: string, def = 0) => {
  const v = str(fd, k).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[,٬]/g, "");
  const n = Number(v);
  return v === "" || Number.isNaN(n) ? def : n;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true" || fd.get(k) === "1";
export const file = (fd: FormData, k: string) => {
  const f = fd.get(k);
  return f && typeof f === "object" && "size" in f && f.size > 0 ? (f as File) : null;
};
export function must(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new ActionError(msg);
}
