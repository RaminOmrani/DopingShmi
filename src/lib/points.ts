import "server-only";
import { db } from "./db";
import { getSetting } from "./settings";
import { addDays, tehranDay } from "./utils";

/** امتیاز یکتا: هر (کاربر، دلیل، مرجع) فقط یک‌بار ثبت می‌شود */
export async function award(userId: string, reason: string, refId: string, amount: number) {
  if (!amount) return false;
  try {
    await db.pointLog.create({ data: { userId, reason, refId, amount } });
  } catch {
    return false; // قبلاً ثبت شده
  }
  const day = tehranDay();
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { points: { increment: amount } } }),
    db.activity.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, points: amount },
      update: { points: { increment: amount } },
    }),
  ]);
  return true;
}

/** ضربان حضور: هر ~۶۰ ثانیه از سمت کلاینت */
export async function heartbeat(userId: string, lastSeenAt: Date | null) {
  const now = new Date();
  const elapsed = lastSeenAt ? (now.getTime() - lastSeenAt.getTime()) / 1000 : 999;
  if (elapsed < 40) return; // جلوگیری از شمارش تکراری
  const add = elapsed > 150 ? 60 : Math.round(elapsed);
  const day = tehranDay();
  const p = await getSetting("points");
  const act = await db.activity.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, onlineSec: add },
    update: { onlineSec: { increment: add } },
  });
  await db.user.update({ where: { id: userId }, data: { lastSeenAt: now } });

  // امتیازهای امروزِ قبلاً ثبت‌شده با یک کوئری؛ award() فقط برای موارد جدید (بدون INSERT تکراریِ ناموفق در هر ضربان)
  const onlineRefs: string[] = [];
  const blocks = Math.floor(act.onlineSec / 600);
  for (let b = 1; b <= blocks && b * p.onlinePer10Min <= p.onlineDailyCap; b++) onlineRefs.push(`${day}:${b}`);
  const done = await db.pointLog.findMany({
    where: { userId, reason: { in: ["DAILY", "ONLINE", "STREAK"] }, refId: { in: [day, ...onlineRefs] } },
    select: { reason: true, refId: true },
  });
  const have = new Set(done.map((r) => `${r.reason}|${r.refId}`));

  if (!have.has(`DAILY|${day}`)) await award(userId, "DAILY", day, p.daily);
  for (const ref of onlineRefs) {
    if (!have.has(`ONLINE|${ref}`)) await award(userId, "ONLINE", ref, p.onlinePer10Min);
  }
  if (!have.has(`STREAK|${day}`)) {
    const streak = await streakOf(userId);
    if (streak > 0 && streak % 7 === 0) await award(userId, "STREAK", day, p.streak7);
  }
}

/** تعداد روزهای پیاپی فعال تا امروز */
export async function streakOf(userId: string) {
  const today = tehranDay();
  const from = addDays(today, -60);
  const days = new Set(
    (await db.activity.findMany({ where: { userId, day: { gte: from } }, select: { day: true } })).map((a) => a.day),
  );
  let n = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export async function examPoints(userId: string, examId: string, percent: number) {
  const p = await getSetting("points");
  const bonus = Math.round((Math.max(0, Math.min(100, percent)) / 100) * p.examBonusMax);
  await award(userId, "EXAM", examId, p.examBase + bonus);
}
