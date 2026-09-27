"use server";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { adminAction, bool, file, must, num, optStr, str, type Result } from "@/lib/action";
import { getUser, isAdmin } from "@/lib/auth";
import { parseJalali } from "@/lib/jalali";
import { saveImage } from "@/lib/upload";
import { sendBulk } from "@/lib/sms";
import { examPoints } from "@/lib/points";
import { resultPercent } from "@/lib/stats";
import { fmtDate, normalizePhone, toEnDigits } from "@/lib/utils";

export const saveExam = adminAction(async (fd) => {
  const id = str(fd, "id");
  const startRaw = str(fd, "startAt");
  const endRaw = str(fd, "endAt");
  const startAt = parseJalali(startRaw);
  const endAt = parseJalali(endRaw);
  must(!startRaw || startAt, "تاریخ شروع را به شکل ۱۴۰۵/۰۷/۱۰ ۱۶:۰۰ وارد کنید");
  must(!endRaw || endAt, "تاریخ پایان را به شکل ۱۴۰۵/۰۷/۱۲ ۲۲:۰۰ وارد کنید");
  const kind = str(fd, "kind") === "EXTERNAL" ? "EXTERNAL" : "INTERNAL";
  const data = {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    kind,
    externalUrl: optStr(fd, "externalUrl"),
    openMode: str(fd, "openMode") || "TAB",
    grade: optStr(fd, "grade"),
    major: optStr(fd, "major"),
    audience: str(fd, "audience") || "STUDENTS",
    classGroupId: optStr(fd, "classGroupId"),
    durationMin: Math.max(1, num(fd, "durationMin", 30)),
    startAt,
    endAt,
    negative: bool(fd, "negative"),
    showAnswers: bool(fd, "showAnswers"),
    maxScore: num(fd, "maxScore", 100) || 100,
    published: bool(fd, "published"),
  };
  must(data.title, "عنوان آزمون را وارد کنید");
  must(kind === "INTERNAL" || data.externalUrl, "لینک آزمون پلکان را وارد کنید");
  must(data.audience !== "GROUP" || data.classGroupId, "کلاس را انتخاب کنید");
  const prev = id ? await db.exam.findUnique({ where: { id } }) : null;
  const exam = id ? await db.exam.update({ where: { id }, data }) : await db.exam.create({ data });
  if (exam.published && !prev?.published && bool(fd, "notify")) {
    const users = await db.user.findMany({
      where: {
        role: "USER", blocked: false,
        ...(exam.grade ? { grade: exam.grade } : {}),
        ...(exam.major ? { major: exam.major } : {}),
        ...(exam.audience === "STUDENTS" ? { classStatus: "APPROVED" } : exam.audience === "GROUP" ? { classStatus: "APPROVED", classGroupId: exam.classGroupId } : {}),
      },
      select: { id: true, phone: true, name: true },
    });
    const until = exam.endAt ? fmtDate(exam.endAt, true) : "اطلاع ثانوی";
    await db.notification.create({ data: { title: "آزمون جدید 📝", body: `«${exam.title}» فعال شد${exam.endAt ? ` (تا ${until})` : ""}.`, audience: { grade: exam.grade, major: exam.major, classGroupId: exam.audience === "GROUP" ? exam.classGroupId : null, studentsOnly: exam.audience !== "ALL" } } });
    if (users.length) await sendBulk({ title: `آزمون جدید: ${exam.title}`, templateKey: "exam_new", recipients: users, vars: (r) => ({ name: r.name, exam: exam.title, until }) });
  }
  revalidatePath("/admin/exams", "layout");
  return { ok: true, message: id ? "ذخیره شد" : "آزمون ساخته شد", data: exam.id };
});

export const deleteExam = adminAction(async (fd) => {
  await db.exam.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/admin/exams");
  return { ok: true, message: "حذف شد" };
});

export const saveQuestion = adminAction(async (fd) => {
  const id = str(fd, "id");
  const examId = str(fd, "examId");
  const options = [0, 1, 2, 3].map((i) => str(fd, `o${i}`));
  must(str(fd, "text") || file(fd, "image") || id, "متن یا تصویر سؤال لازم است");
  must(options.every(Boolean), "هر چهار گزینه را وارد کنید");
  const data: Record<string, unknown> = { text: str(fd, "text"), options, correct: num(fd, "correct"), explanation: optStr(fd, "explanation"), order: num(fd, "order") };
  const img = file(fd, "image");
  if (img) data.image = (await saveImage(img, "questions", 1400)).url;
  if (bool(fd, "removeImage")) data.image = null;
  if (id) await db.question.update({ where: { id }, data });
  else await db.question.create({ data: { ...(data as { text: string; options: string[]; correct: number }), examId } });
  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true };
});

export const deleteQuestion = adminAction(async (fd) => {
  await db.question.delete({ where: { id: str(fd, "id") } });
  revalidatePath(`/admin/exams/${str(fd, "examId")}`);
  return { ok: true, message: "حذف شد" };
});

/** ثبت دستی نمره‌ها (score_USERID) */
export const saveManualScores = adminAction(async (fd) => {
  const examId = str(fd, "examId");
  const exam = await db.exam.findUniqueOrThrow({ where: { id: examId } });
  let n = 0;
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("score_")) continue;
    const raw = toEnDigits(String(v)).trim();
    if (!raw) continue;
    const score = Number(raw);
    if (Number.isNaN(score)) continue;
    const userId = k.slice(6);
    await upsertScore(examId, userId, { score, percent: null, taraz: null, rank: null }, exam.maxScore, "MANUAL");
    n++;
  }
  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true, message: `${n} نمره ثبت شد` };
});

async function upsertScore(examId: string, userId: string, v: { score: number | null; percent: number | null; taraz: number | null; rank: number | null }, maxScore: number, source: string) {
  const data = { status: "SUBMITTED", source, submittedAt: new Date(), score: v.score, percent: v.percent, taraz: v.taraz, rank: v.rank };
  const prev = await db.examResult.findUnique({ where: { examId_userId: { examId, userId } } });
  await db.examResult.upsert({ where: { examId_userId: { examId, userId } }, create: { examId, userId, ...data }, update: data });
  const pct = resultPercent({ percent: v.percent, score: v.score }, maxScore) ?? 0;
  if (prev?.status !== "SUBMITTED") await examPoints(userId, examId, pct);
}

const normName = (s: string) => s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[‌\s]+/g, " ").trim();

/** خواندن فایل اکسل/CSV کارنامه برای پیش‌نمایش */
export async function parseResultsFile(_prev: Result, fd: FormData): Promise<Result> {
  if (!isAdmin(await getUser())) return { error: "دسترسی ندارید" };
  const f = file(fd, "file");
  if (!f) return { error: "فایل را انتخاب کنید" };
  try {
    let rows: string[][] = [];
    const buf = Buffer.from(await f.arrayBuffer());
    if (/\.csv$/i.test(f.name) || f.type === "text/csv") {
      const text = buf.toString("utf8").replace(/^﻿/, "");
      rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/[,;\t]/).map((c) => c.replace(/^"|"$/g, "").trim()));
    } else {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      const ws = wb.worksheets[0];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const vals = (row.values as unknown[]).slice(1).map((c) => {
          if (c && typeof c === "object") {
            const o = c as { text?: string; result?: unknown; richText?: { text: string }[] };
            return String(o.text ?? o.result ?? o.richText?.map((r) => r.text).join("") ?? "");
          }
          return c === null || c === undefined ? "" : String(c);
        });
        rows.push(vals.map((v) => v.trim()));
      });
    }
    if (rows.length < 2) return { error: "فایل خالی است یا سطر داده ندارد" };
    // سطر سرتیتر: اولین سطری که حداقل ۲ خانه‌ی غیرعددی دارد
    let h = rows.findIndex((r) => r.filter((c) => c && Number.isNaN(Number(toEnDigits(c)))).length >= 2);
    if (h < 0) h = 0;
    const width = Math.max(...rows.map((r) => r.length));
    const headers = Array.from({ length: width }, (_, i) => rows[h][i] || `ستون ${i + 1}`);
    return { ok: true, message: `${rows.length - h - 1} سطر خوانده شد`, data: { headers, rows: rows.slice(h + 1, h + 2001).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")) } };
  } catch (e) {
    console.error(e);
    return { error: "فایل قابل خواندن نیست؛ فرمت xlsx یا csv بفرستید" };
  }
}

/** ثبت نتایج از فایل با نگاشت ستون‌ها */
export async function importResults(examId: string, map: { phone: number; name: number; score: number; taraz: number; rank: number; isPercent: boolean }, rows: string[][]) {
  if (!isAdmin(await getUser())) return { error: "دسترسی ندارید" };
  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) return { error: "آزمون یافت نشد" };
  const users = await db.user.findMany({ where: { role: "USER" }, select: { id: true, phone: true, name: true } });
  const byPhone = new Map(users.map((u) => [u.phone, u.id]));
  const byName = new Map<string, string[]>();
  for (const u of users) {
    const k = normName(u.name);
    if (k) byName.set(k, [...(byName.get(k) ?? []), u.id]);
  }
  let ok = 0;
  const unmatched: string[] = [];
  const cell = (r: string[], i: number) => (i >= 0 ? toEnDigits(r[i] ?? "").replace(/[٫]/g, ".").replace(/[٬,]/g, "").trim() : "");
  for (const r of rows) {
    const phone = map.phone >= 0 ? normalizePhone(r[map.phone]) : null;
    let userId = phone ? byPhone.get(phone) : undefined;
    if (!userId && map.name >= 0) {
      const c = byName.get(normName(r[map.name] ?? ""));
      if (c?.length === 1) userId = c[0];
    }
    const scoreStr = cell(r, map.score);
    if (!scoreStr || Number.isNaN(Number(scoreStr))) continue;
    if (!userId) {
      unmatched.push(`${r[map.name] ?? ""} ${r[map.phone] ?? ""}`.trim());
      continue;
    }
    const val = Number(scoreStr);
    const taraz = cell(r, map.taraz);
    const rank = cell(r, map.rank);
    await upsertScore(examId, userId, {
      score: map.isPercent ? null : val,
      percent: map.isPercent ? val : null,
      taraz: taraz && !Number.isNaN(Number(taraz)) ? Math.round(Number(taraz)) : null,
      rank: rank && !Number.isNaN(Number(rank)) ? Math.round(Number(rank)) : null,
    }, exam.maxScore, "IMPORT");
    ok++;
  }
  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true, imported: ok, unmatched };
}

export const sendResultsSms = adminAction(async (fd) => {
  const examId = str(fd, "examId");
  const exam = await db.exam.findUniqueOrThrow({ where: { id: examId } });
  const results = await db.examResult.findMany({ where: { examId, status: "SUBMITTED" }, include: { user: true } });
  must(results.length, "نتیجه‌ای ثبت نشده است");
  const scoreText = (r: (typeof results)[number]) => {
    const p = resultPercent(r, exam.maxScore);
    return r.score !== null && exam.kind === "EXTERNAL" ? `${r.score} از ${exam.maxScore}` : p !== null ? `${Math.round(p * 10) / 10} درصد` : "-";
  };
  const byUser = new Map(results.map((r) => [r.userId, r]));
  await sendBulk({
    title: `نتایج: ${exam.title}`,
    templateKey: "exam_result",
    recipients: results.map((r) => ({ id: r.userId, phone: r.user.phone, name: r.user.name, parentPhone: r.user.parentPhone, parentSms: r.user.parentSms })),
    vars: (u) => ({ name: u.name, exam: exam.title, score: scoreText(byUser.get(u.id)!) }),
    parent: bool(fd, "parents") ? { templateKey: "parent_exam_result", vars: (u) => ({ exam: exam.title, name: u.name, score: scoreText(byUser.get(u.id)!) }) } : undefined,
  });
  return { ok: true, message: `پیامک نتیجه برای ${results.length} نفر در صف ارسال قرار گرفت` };
});
