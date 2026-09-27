import { db } from "@/lib/db";
import { HttpError, mustUser, ok, route } from "@/lib/api";
import { getSetting } from "@/lib/settings";
import { resolveItem } from "@/lib/payitem";
import { saveImage } from "@/lib/upload";
import { sendTemplate } from "@/lib/sms";
import { normalizePhone, toEnDigits } from "@/lib/utils";

/** ثبت رسید کارت‌به‌کارت برای بررسی مدیر */
export const POST = route(async (req) => {
  const user = await mustUser();
  const fd = await req.formData().catch(() => null);
  if (!fd) throw new HttpError(400, "اطلاعات ارسالی نامعتبر است");
  const type = fd.get("type") === "BUNDLE" ? "BUNDLE" : "TOPIC";
  const id = String(fd.get("id") ?? "");
  const tracking = toEnDigits(String(fd.get("tracking") ?? "")).trim();
  if (tracking.length < 4) throw new HttpError(400, "شماره پیگیری یا ۴ رقم آخر کارت خود را وارد کنید");
  const pay = await getSetting("payment");
  if (!pay.cardEnabled) throw new HttpError(503, "پرداخت کارت‌به‌کارت فعال نیست");
  const { amount, title } = await resolveItem(user, type, id);

  let receiptUrl: string | null = null;
  const f = fd.get("receipt");
  if (f && typeof f === "object" && "size" in f && f.size > 0) receiptUrl = (await saveImage(f as File, "receipts", 1600)).url;

  const existing = await db.payment.findFirst({ where: { userId: user.id, itemType: type, itemId: id, status: "REVIEW" } });
  const data = { amount, tracking, method: "CARD", status: "REVIEW", description: title, ...(receiptUrl ? { receiptUrl } : {}) };
  if (existing) await db.payment.update({ where: { id: existing.id }, data });
  else await db.payment.create({ data: { ...data, userId: user.id, itemType: type, itemId: id } });

  // خبر به مدیر
  const site = await getSetting("site");
  const admin = normalizePhone(site.phone);
  if (admin) sendTemplate("general", admin, { message: `رسید کارت‌به‌کارت جدید: ${user.name} — ${title} (${amount.toLocaleString("fa-IR")} تومان). بررسی در پنل ← پرداخت‌ها` }).catch(() => {});
  return ok({ ok: true });
});
