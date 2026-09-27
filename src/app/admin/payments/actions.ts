"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { adminAction, must, str } from "@/lib/action";
import { fulfill } from "@/lib/purchase";
import { sendTemplate } from "@/lib/sms";

export const approveCard = adminAction(async (fd) => {
  const p = await db.payment.findUnique({ where: { id: str(fd, "id") } });
  must(p && p.status === "REVIEW", "این رسید قبلاً بررسی شده است");
  await fulfill(p.id, p.tracking ? `کارت: ${p.tracking}` : "کارت‌به‌کارت");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "تأیید شد؛ دسترسی فعال و پیامک ارسال شد" };
});

export const rejectCard = adminAction(async (fd) => {
  const reason = str(fd, "reason") || "واریز با این مشخصات پیدا نشد";
  const p = await db.payment.update({ where: { id: str(fd, "id") }, data: { status: "FAILED", error: reason }, include: { user: true } });
  await db.notification.create({ data: { userId: p.userId, title: "رسید پرداخت تأیید نشد", body: `«${p.description}»: ${reason}. در صورت واریز، با پشتیبانی تماس بگیرید.` } });
  await sendTemplate("general", p.user.phone, { message: `رسید پرداخت «${p.description}» تأیید نشد: ${reason}` }, { userId: p.userId }).catch(() => {});
  revalidatePath("/admin", "layout");
  return { ok: true, message: "رد شد و به دانش‌آموز اطلاع داده شد" };
});
