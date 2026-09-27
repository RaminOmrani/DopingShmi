import { db } from "@/lib/db";
import { HttpError, mustUser, ok, route } from "@/lib/api";
import { canSeeExam, examState } from "@/lib/exams";

type Ctx = { params: Promise<{ id: string }> };

/** ورود به آزمون بیرونی (پلکان): ثبت شرکت و برگرداندن لینک */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await mustUser();
  const { id } = await params;
  if (!(await canSeeExam(user, id))) throw new HttpError(404, "آزمون یافت نشد");
  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam?.externalUrl) throw new HttpError(404, "لینک آزمون ثبت نشده است");
  if (examState(exam) === "UPCOMING") throw new HttpError(409, "آزمون هنوز شروع نشده است");
  await db.examResult.upsert({
    where: { examId_userId: { examId: id, userId: user.id } },
    create: { examId: id, userId: user.id, status: "LAUNCHED", source: "IMPORT" },
    update: {},
  });
  return ok({ url: exam.externalUrl });
});
