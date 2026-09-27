"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser, hashPassword, isAdmin } from "@/lib/auth";
import { adminAction, bool, must, num, optStr, str } from "@/lib/action";
import { sendTemplate } from "@/lib/sms";
import { award } from "@/lib/points";
import { normalizePhone } from "@/lib/utils";

async function guard() {
  const u = await getUser();
  if (!isAdmin(u)) throw new Error("forbidden");
  return u!;
}

export async function approveUser(id: string, approve: boolean) {
  await guard();
  const u = await db.user.update({ where: { id }, data: { classStatus: approve ? "APPROVED" : "REJECTED" } });
  if (approve) {
    await db.notification.create({ data: { userId: id, title: "تأیید شد 🎉", body: "شما به‌عنوان شاگرد کلاس‌های استاد تأیید شدید؛ همه‌ی ویدیوها و آزمون‌های کلاس برایتان باز است." } });
    await sendTemplate("welcome", u.phone, { name: u.name }, { userId: id }).catch(() => {});
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export const updateUser = adminAction(async (fd) => {
  const me = await guard();
  const id = str(fd, "id");
  const role = str(fd, "role");
  const data: Record<string, unknown> = {
    name: str(fd, "name"),
    grade: optStr(fd, "grade"),
    major: optStr(fd, "major"),
    city: optStr(fd, "city"),
    classStatus: str(fd, "classStatus") || "NONE",
    classGroupId: optStr(fd, "classGroupId"),
    blocked: bool(fd, "blocked"),
  };
  if (me.role === "ADMIN" && ["ADMIN", "STAFF", "USER"].includes(role)) {
    must(!(id === me.id && role !== "ADMIN"), "نمی‌توانید نقش خودتان را تغییر دهید");
    data.role = role;
  }
  const pw = str(fd, "password");
  if (pw) {
    must(pw.length >= 6, "رمز عبور حداقل ۶ کاراکتر");
    data.passwordHash = hashPassword(pw);
  }
  await db.user.update({ where: { id }, data });
  revalidatePath(`/admin/users/${id}`);
  return { ok: true };
});

export const givePoints = adminAction(async (fd) => {
  const id = str(fd, "id");
  const n = Math.round(num(fd, "points"));
  must(n !== 0, "مقدار امتیاز را وارد کنید");
  await award(id, "ADMIN", `${Date.now()}`, n);
  if (n > 0) await db.notification.create({ data: { userId: id, title: "امتیاز هدیه 🎁", body: `استاد به شما ${n} امتیاز هدیه داد${str(fd, "reason") ? `: ${str(fd, "reason")}` : ""}.` } });
  revalidatePath(`/admin/users/${id}`);
  return { ok: true, message: "امتیاز ثبت شد" };
});

export const grantAccess = adminAction(async (fd) => {
  const id = str(fd, "id");
  const item = str(fd, "item"); // topic:ID یا bundle:ID
  const days = num(fd, "days");
  must(item.includes(":"), "مبحث یا بسته را انتخاب کنید");
  const [type, itemId] = item.split(":");
  await db.purchase.create({
    data: { userId: id, amount: 0, topicId: type === "topic" ? itemId : null, bundleId: type === "bundle" ? itemId : null, expiresAt: days > 0 ? new Date(Date.now() + days * 86400000) : null },
  });
  revalidatePath(`/admin/users/${id}`);
  return { ok: true, message: "دسترسی داده شد" };
});

export const revokeAccess = adminAction(async (fd) => {
  await db.purchase.delete({ where: { id: str(fd, "purchaseId") } });
  revalidatePath(`/admin/users/${str(fd, "id")}`);
  return { ok: true, message: "دسترسی حذف شد" };
});

export const smsUser = adminAction(async (fd) => {
  const id = str(fd, "id");
  const text = str(fd, "text");
  must(text.length > 1, "متن پیام را بنویسید");
  const u = await db.user.findUniqueOrThrow({ where: { id } });
  const toParent = bool(fd, "parent");
  must(!toParent || u.parentPhone, "شماره ولی ثبت نشده است");
  const r = await sendTemplate("general", toParent ? u.parentPhone! : u.phone, { message: text }, { userId: id });
  await db.notification.create({ data: { userId: id, title: "پیام استاد", body: text } });
  return r.ok ? { ok: true, message: "پیام ارسال شد" } : { error: `ارسال نشد: ${r.error}` };
});

export const createUser = adminAction(async (fd) => {
  const phone = normalizePhone(str(fd, "phone"));
  must(phone, "شماره موبایل معتبر نیست");
  must(!(await db.user.findUnique({ where: { phone } })), "این شماره قبلاً ثبت شده است");
  await db.user.create({
    data: { phone, name: str(fd, "name"), grade: optStr(fd, "grade"), major: optStr(fd, "major"), classStatus: bool(fd, "approved") ? "APPROVED" : "NONE", classGroupId: optStr(fd, "classGroupId"), profileDone: !!str(fd, "name") && !!optStr(fd, "grade") },
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "دانش‌آموز اضافه شد" };
});
