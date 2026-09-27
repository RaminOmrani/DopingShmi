import "server-only";
import { db } from "./db";
import { sendTemplate } from "./sms";

/** کارهای زمان‌بندی‌شده (هر ساعت) */
export async function hourly() {
  // پاک‌سازی کدهای ورود قدیمی
  await db.otpCode.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400000) } } });
  // یادآوری ۳ روز قبل از پایان دسترسی
  const soon = await db.purchase.findMany({
    where: { remindedAt: null, expiresAt: { gt: new Date(), lt: new Date(Date.now() + 3 * 86400000) } },
    include: { user: true, bundle: true, topic: true },
    take: 200,
  });
  for (const p of soon) {
    const days = Math.max(1, Math.ceil((p.expiresAt!.getTime() - Date.now()) / 86400000));
    const item = p.bundle?.title ?? p.topic?.title ?? "";
    await sendTemplate("sub_expiring", p.user.phone, { name: p.user.name, item, days }, { userId: p.userId }).catch(() => {});
    await db.purchase.update({ where: { id: p.id }, data: { remindedAt: new Date() } });
  }
}
