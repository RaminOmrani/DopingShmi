import "server-only";
import { db } from "./db";
import { HttpError } from "./api";
import { getAccess } from "./access";
import type { SessionUser } from "./auth";

/** مبحث/بسته‌ی قابل خرید + مبلغ */
export async function resolveItem(user: SessionUser, type: "TOPIC" | "BUNDLE", id: string) {
  if (type === "TOPIC") {
    const t = await db.topic.findUnique({ where: { id } });
    if (!t || !t.published || t.price <= 0) throw new HttpError(404, "این مبحث قابل خرید نیست");
    const a = await getAccess(user);
    if (a.all || a.topicIds.has(t.id)) throw new HttpError(409, "شما به این مبحث دسترسی دارید");
    return { amount: t.price, title: t.title };
  }
  const b = await db.bundle.findUnique({ where: { id } });
  if (!b || !b.active) throw new HttpError(404, "بسته یافت نشد");
  return { amount: b.price, title: b.title };
}
