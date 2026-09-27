import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, mustUser, ok, route } from "@/lib/api";
import { getSetting } from "@/lib/settings";
import { zpRequest, startPayUrl } from "@/lib/zarinpal";
import { getAccess } from "@/lib/access";

export const POST = route(async (req) => {
  const user = await mustUser();
  const b = await body(req, z.object({ type: z.enum(["TOPIC", "BUNDLE"]), id: z.string() }));
  const pay = await getSetting("payment");
  if (!pay.enabled || !pay.merchantId) throw new HttpError(503, "پرداخت آنلاین هنوز فعال نشده است؛ با پشتیبانی تماس بگیرید");

  let amount = 0;
  let title = "";
  if (b.type === "TOPIC") {
    const t = await db.topic.findUnique({ where: { id: b.id } });
    if (!t || !t.published || t.price <= 0) throw new HttpError(404, "این مبحث قابل خرید نیست");
    const a = await getAccess(user);
    if (a.all || a.topicIds.has(t.id)) throw new HttpError(409, "شما به این مبحث دسترسی دارید");
    amount = t.price;
    title = t.title;
  } else {
    const bu = await db.bundle.findUnique({ where: { id: b.id } });
    if (!bu || !bu.active) throw new HttpError(404, "بسته یافت نشد");
    amount = bu.price;
    title = bu.title;
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
