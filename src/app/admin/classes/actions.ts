"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { adminAction, bool, must, num, optStr, str } from "@/lib/action";
import { sendBulk } from "@/lib/sms";

export const saveGroup = adminAction(async (fd) => {
  const id = str(fd, "id");
  const data = { name: str(fd, "name"), grade: optStr(fd, "grade"), major: optStr(fd, "major"), location: optStr(fd, "location"), schedule: optStr(fd, "schedule"), order: num(fd, "order"), active: bool(fd, "active") };
  must(data.name, "نام کلاس را وارد کنید");
  if (id) await db.classGroup.update({ where: { id }, data });
  else await db.classGroup.create({ data });
  revalidatePath("/admin/classes");
  return { ok: true };
});

export const deleteGroup = adminAction(async (fd) => {
  await db.classGroup.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/admin/classes");
  return { ok: true, message: "حذف شد" };
});

const KIND: Record<string, { tpl: string; status: string; title: string }> = {
  FIXED: { tpl: "class_fixed", status: "برگزار می‌شود", title: "برنامه کلاس" },
  CANCELLED: { tpl: "class_cancelled", status: "لغو شد", title: "لغو کلاس" },
  RESCHEDULED: { tpl: "class_rescheduled", status: "جابه‌جا شد", title: "تغییر زمان کلاس" },
};

export const createEvent = adminAction(async (fd) => {
  const groupId = str(fd, "groupId");
  const kind = str(fd, "kind");
  const date = str(fd, "date");
  const time = str(fd, "time");
  must(KIND[kind], "نوع اطلاع‌رسانی نامعتبر است");
  must(date, "تاریخ را وارد کنید");
  const g = await db.classGroup.findUniqueOrThrow({ where: { id: groupId } });
  const place = str(fd, "location") || g.location || "";
  const note = optStr(fd, "note");
  const members = await db.user.findMany({ where: { classGroupId: groupId, classStatus: "APPROVED", blocked: false }, select: { id: true, phone: true, name: true, parentPhone: true, parentSms: true } });
  const ev = await db.classEvent.create({ data: { classGroupId: groupId, kind, date, time: time || null, location: place || null, note } });
  const k = KIND[kind];
  await db.notification.create({
    data: {
      title: `${k.title}: ${g.name}`,
      body: `${date}${time ? ` ساعت ${time}` : ""} — ${k.status}${place && kind !== "CANCELLED" ? ` · ${place}` : ""}${note ? `\n${note}` : ""}`,
      audience: { classGroupId: groupId },
    },
  });
  if (bool(fd, "sms") && members.length) {
    await sendBulk({
      title: `${k.title} — ${g.name}`,
      templateKey: k.tpl,
      recipients: members,
      vars: (r) => ({ name: r.name, class: g.name, date, time: time || "-", place }),
      parent: bool(fd, "parents") ? { templateKey: "parent_class", vars: (r) => ({ class: g.name, name: r.name, status: k.status, date, time: time || "-" }) } : undefined,
    });
    await db.classEvent.update({ where: { id: ev.id }, data: { smsSent: members.length } });
  }
  revalidatePath("/admin/classes");
  return { ok: true, message: bool(fd, "sms") ? `ثبت شد و پیامک برای ${members.length} نفر در صف ارسال قرار گرفت` : "ثبت شد" };
});

/** کلاس خصوصی (تک‌نفره): اطلاع‌رسانی به یک دانش‌آموز */
export const createPrivateEvent = adminAction(async (fd) => {
  const userId = str(fd, "userId");
  const kind = str(fd, "kind");
  const date = str(fd, "date");
  const time = str(fd, "time");
  must(userId, "دانش‌آموز را انتخاب کنید");
  must(KIND[kind], "نوع اطلاع‌رسانی نامعتبر است");
  must(date, "تاریخ را وارد کنید");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const place = str(fd, "location") || "محل همیشگی";
  const note = optStr(fd, "note");
  const k = KIND[kind];
  await db.classEvent.create({ data: { userId, kind, date, time: time || null, location: place, note, smsSent: bool(fd, "sms") ? 1 : 0 } });
  await db.notification.create({
    data: { userId, title: `کلاس خصوصی: ${k.status}`, body: `${date}${time ? ` ساعت ${time}` : ""}${kind !== "CANCELLED" ? ` · ${place}` : ""}${note ? `\n${note}` : ""}` },
  });
  if (bool(fd, "sms")) {
    await sendBulk({
      title: `کلاس خصوصی — ${u.name}`,
      templateKey: k.tpl,
      recipients: [{ id: u.id, phone: u.phone, name: u.name, parentPhone: u.parentPhone, parentSms: u.parentSms }],
      vars: (r) => ({ name: r.name, class: "خصوصی", date, time: time || "-", place }),
      parent: bool(fd, "parents") ? { templateKey: "parent_class", vars: (r) => ({ class: "خصوصی", name: r.name, status: k.status, date, time: time || "-" }) } : undefined,
    });
  }
  revalidatePath("/admin/classes");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: bool(fd, "sms") ? `ثبت شد و پیامک برای ${u.name} ارسال شد` : "ثبت شد" };
});
