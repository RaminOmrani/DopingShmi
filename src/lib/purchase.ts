import "server-only";
import { db } from "./db";
import { sendTemplate } from "./sms";
import { fmtDate } from "./utils";

/** فعال‌سازی خرید پس از پرداخت موفق */
export async function fulfill(paymentId: string, refId: string | null) {
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { user: true } });
  if (!p || p.status === "PAID") return p;
  let title = "";
  let expiresAt: Date | null = null;
  if (p.itemType === "BUNDLE") {
    const b = await db.bundle.findUnique({ where: { id: p.itemId } });
    title = b?.title ?? "بسته";
    if (b?.durationDays) expiresAt = new Date(Date.now() + b.durationDays * 86400000);
    await db.purchase.create({ data: { userId: p.userId, bundleId: p.itemId, amount: p.amount, expiresAt, paymentId: p.id } });
  } else {
    const t = await db.topic.findUnique({ where: { id: p.itemId } });
    title = t?.title ?? "مبحث";
    await db.purchase.create({ data: { userId: p.userId, topicId: p.itemId, amount: p.amount, paymentId: p.id } });
  }
  const done = await db.payment.update({ where: { id: p.id }, data: { status: "PAID", refId, paidAt: new Date() } });
  await db.notification.create({ data: { userId: p.userId, title: "خرید موفق 🎉", body: `«${title}» برای شما فعال شد.` } });
  sendTemplate("purchase_ok", p.user.phone, { name: p.user.name, item: title, until: expiresAt ? ` تا ${fmtDate(expiresAt)}` : "" }, { userId: p.userId }).catch(() => {});
  return done;
}
