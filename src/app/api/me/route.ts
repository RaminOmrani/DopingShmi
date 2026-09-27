import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, mustUser, ok, route } from "@/lib/api";
import { normalizePhone } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(3, "نام و نام خانوادگی را کامل وارد کنید").max(60),
  grade: z.enum(["G10", "G11", "G12", "GRAD"], { message: "پایه را انتخاب کنید" }),
  major: z.enum(["TAJROBI", "RIAZI"], { message: "رشته را انتخاب کنید" }),
  province: z.string().trim().max(40).optional().default(""),
  city: z.string().trim().min(2, "شهر را وارد کنید").max(40),
  address: z.string().trim().max(200).optional().default(""),
  school: z.string().trim().max(80).optional().default(""),
  parentPhone: z.string().trim().optional().default(""),
  parentSms: z.boolean().optional().default(false),
  classStudent: z.boolean().optional(),
  classGroupId: z.string().optional().nullable(),
  classNote: z.string().trim().max(200).optional().default(""),
});

export const PATCH = route(async (req) => {
  const user = await mustUser();
  const b = await body(req, schema);
  let parentPhone: string | null = null;
  if (b.parentPhone) {
    parentPhone = normalizePhone(b.parentPhone);
    if (!parentPhone) throw new HttpError(400, "شماره موبایل ولی معتبر نیست");
  }
  const data: Record<string, unknown> = {
    name: b.name,
    grade: b.grade,
    major: b.major,
    province: b.province || null,
    city: b.city,
    address: b.address || null,
    school: b.school || null,
    parentPhone,
    parentSms: !!parentPhone && b.parentSms,
    profileDone: true,
  };
  // درخواست شاگرد کلاس بودن (فقط اگر هنوز تأیید نشده)
  if (b.classStudent !== undefined && user.classStatus !== "APPROVED") {
    if (b.classStudent) {
      if (b.classGroupId) {
        const g = await db.classGroup.findUnique({ where: { id: b.classGroupId } });
        if (!g) throw new HttpError(400, "کلاس انتخاب‌شده معتبر نیست");
      }
      Object.assign(data, { classStatus: "PENDING", classGroupId: b.classGroupId || null, classNote: b.classNote || null });
    } else if (user.classStatus === "PENDING") {
      Object.assign(data, { classStatus: "NONE", classGroupId: null });
    }
  }
  await db.user.update({ where: { id: user.id }, data });
  return ok();
});
