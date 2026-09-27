import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, mustUser, ok, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** ذخیره‌ی میانی پاسخ‌ها (برای قطع اینترنت / بسته‌شدن صفحه) */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await mustUser();
  const { id } = await params;
  const { answers } = await body(req, z.object({ answers: z.record(z.string(), z.number().int().min(0).max(3).nullable()) }));
  const r = await db.examResult.findUnique({ where: { examId_userId: { examId: id, userId: user.id } } });
  if (!r || r.status !== "IN_PROGRESS") throw new HttpError(409, "آزمون فعال نیست");
  await db.examResult.update({ where: { id: r.id }, data: { answers } });
  return ok();
});
