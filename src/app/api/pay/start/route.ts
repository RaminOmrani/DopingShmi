import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, mustUser, ok, route } from "@/lib/api";
import { getSetting } from "@/lib/settings";
import { zpRequest, startPayUrl } from "@/lib/zarinpal";
import { resolveItem } from "@/lib/payitem";

export const POST = route(async (req) => {
  const user = await mustUser();
  const b = await body(req, z.object({ type: z.enum(["TOPIC", "BUNDLE"]), id: z.string() }));
  const pay = await getSetting("payment");
  const { amount, title } = await resolveItem(user, b.type, b.id);

  // درگاه فعال نیست → کارت‌به‌کارت
  if (!pay.enabled || !pay.merchantId) {
    if (!pay.cardEnabled || !pay.cards.length) throw new HttpError(503, "پرداخت آنلاین هنوز فعال نشده است؛ با پشتیبانی تماس بگیرید");
    const pending = await db.payment.findFirst({ where: { userId: user.id, itemType: b.type, itemId: b.id, status: "REVIEW" } });
    return ok({ card: { cards: pay.cards, note: pay.cardNote, amount, title, pending: !!pending } });
  }

  const origin = process.env.SITE_URL || new URL(req.url).origin;
  const payment = await db.payment.create({ data: { userId: user.id, amount, itemType: b.type, itemId: b.id, description: title } });
  const r = await zpRequest(pay, { amount, description: `دوپینگ شیمی — ${title}`, callbackUrl: `${origin}/api/pay/callback?pid=${payment.id}`, mobile: user.phone });
  if (!r.ok || !r.authority) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", error: r.error } });
    throw new HttpError(502, r.error || "خطا در اتصال به درگاه");
  }
  await db.payment.update({ where: { id: payment.id }, data: { authority: r.authority } });
  return ok({ url: startPayUrl(pay, r.authority) });
});
