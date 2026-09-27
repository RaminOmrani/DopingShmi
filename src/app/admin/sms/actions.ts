"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { adminAction, bool, must, optStr, str } from "@/lib/action";
import { sendBulk } from "@/lib/sms";

export const sendGeneral = adminAction(async (fd) => {
  const text = str(fd, "text");
  must(text.length >= 2, "متن پیام را بنویسید");
  const aud = str(fd, "audience");
  const grade = optStr(fd, "grade");
  const major = optStr(fd, "major");
  const groupId = optStr(fd, "groupId");
  const where: Prisma.UserWhereInput = { role: "USER", blocked: false, ...(grade ? { grade } : {}), ...(major ? { major } : {}) };
  if (aud === "STUDENTS") where.classStatus = "APPROVED";
  if (aud === "FREE") where.classStatus = { not: "APPROVED" };
  if (aud === "PENDING") where.classStatus = "PENDING";
  if (aud === "GROUP") {
    must(groupId, "کلاس را انتخاب کنید");
    Object.assign(where, { classStatus: "APPROVED", classGroupId: groupId });
  }
  const users = await db.user.findMany({ where, select: { id: true, phone: true, name: true, parentPhone: true, parentSms: true } });
  if (bool(fd, "inapp")) {
    await db.notification.create({ data: { title: str(fd, "title") || "پیام استاد", body: text, audience: { grade, major, classGroupId: aud === "GROUP" ? groupId : null, studentsOnly: aud === "STUDENTS" || aud === "GROUP" } } });
  }
  if (!bool(fd, "sms")) return { ok: true, message: "اطلاعیه در اپلیکیشن ثبت شد" };
  must(users.length, "گیرنده‌ای با این فیلتر وجود ندارد");
  const personalize = (r: { name: string }) => text.replace(/\{\{name\}\}/g, r.name || "دانش‌آموز");
  await sendBulk({
    title: str(fd, "title") || text.slice(0, 40),
    templateKey: "general",
    recipients: users,
    vars: (r) => ({ message: personalize(r) }),
    parent: bool(fd, "parents") ? { templateKey: "general", vars: (r) => ({ message: `ولی گرامی ${r.name}: ${personalize(r)}` }) } : undefined,
  });
  revalidatePath("/admin/sms");
  return { ok: true, message: `ارسال برای ${users.length} نفر شروع شد` };
});

export const saveTemplate = adminAction(async (fd) => {
  await db.smsTemplate.update({ where: { key: str(fd, "key") }, data: { body: str(fd, "body"), bodyId: optStr(fd, "bodyId"), enabled: bool(fd, "enabled") } });
  revalidatePath("/admin/sms");
  return { ok: true };
});
