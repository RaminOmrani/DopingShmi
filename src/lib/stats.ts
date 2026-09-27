import "server-only";
import { db } from "./db";
import { levelOf } from "./constants";
import { addDays, tehranDay } from "./utils";
import { streakOf } from "./points";

export const resultPercent = (r: { percent: number | null; score: number | null }, maxScore: number) =>
  r.percent ?? (r.score !== null && maxScore > 0 ? (r.score / maxScore) * 100 : null);

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** آمار کامل یک دانش‌آموز + مقایسه با گروه (پایه + رشته) */
export async function userStats(user: { id: string; grade: string | null; major: string | null; points: number }) {
  const today = tehranDay();
  const from = addDays(today, -29);

  const [results, acts, progress, groupUsers] = await Promise.all([
    db.examResult.findMany({
      where: { userId: user.id, status: "SUBMITTED" },
      include: { exam: { select: { id: true, title: true, maxScore: true, kind: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    db.activity.findMany({ where: { userId: user.id, day: { gte: from } }, orderBy: { day: "asc" } }),
    db.videoProgress.findMany({ where: { userId: user.id }, include: { video: { select: { topicId: true, durationSec: true } } } }),
    db.user.findMany({
      where: { grade: user.grade, major: user.major, role: "USER", blocked: false },
      select: { id: true, points: true },
      orderBy: { points: "desc" },
    }),
  ]);

  // میانگین گروه در همان آزمون‌ها
  const examIds = results.map((r) => r.examId);
  const groupIds = groupUsers.map((g) => g.id);
  const peers = examIds.length
    ? await db.examResult.findMany({
        where: { examId: { in: examIds }, status: "SUBMITTED", userId: { in: groupIds } },
        select: { examId: true, percent: true, score: true, exam: { select: { maxScore: true } } },
      })
    : [];
  const peerAvg = new Map<string, number | null>();
  for (const id of examIds) {
    peerAvg.set(id, avg(peers.filter((p) => p.examId === id).map((p) => resultPercent(p, p.exam.maxScore)).filter((x): x is number => x !== null)));
  }

  const exams = results.map((r) => ({
    id: r.examId,
    title: r.exam.title,
    date: (r.submittedAt ?? r.startedAt).toISOString(),
    percent: resultPercent(r, r.exam.maxScore),
    groupAvg: peerAvg.get(r.examId) ?? null,
    correct: r.correct,
    wrong: r.wrong,
    blank: r.blank,
    taraz: r.taraz,
    rank: r.rank,
    kind: r.exam.kind,
  }));

  const byDay = new Map(acts.map((a) => [a.day, a]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(from, i);
    const a = byDay.get(d);
    return { day: d, videoMin: Math.round((a?.videoSec ?? 0) / 60), onlineMin: Math.round((a?.onlineSec ?? 0) / 60), points: a?.points ?? 0 };
  });

  const percents = exams.map((e) => e.percent).filter((x): x is number => x !== null);
  const last = percents.slice(-3);
  const prev = percents.slice(-6, -3);
  const trend = last.length && prev.length ? (avg(last)! - avg(prev)!) : null;

  const rankInGroup = groupUsers.findIndex((g) => g.id === user.id) + 1;
  const totalVideoSec = progress.reduce((s, p) => s + p.watchedSeconds, 0);

  return {
    level: levelOf(user.points),
    points: user.points,
    streak: await streakOf(user.id),
    rankInGroup: rankInGroup || null,
    groupSize: groupUsers.length,
    exams,
    examCount: exams.length,
    avgPercent: avg(percents),
    bestPercent: percents.length ? Math.max(...percents) : null,
    trend,
    days,
    totalVideoSec,
    completedVideos: progress.filter((p) => p.completed).length,
    startedVideos: progress.length,
    progressByTopic: progress.reduce<Record<string, number>>((m, p) => {
      if (p.completed) m[p.video.topicId] = (m[p.video.topicId] ?? 0) + 1;
      return m;
    }, {}),
    monthOnlineSec: acts.reduce((s, a) => s + a.onlineSec, 0),
  };
}
export type UserStats = Awaited<ReturnType<typeof userStats>>;

/** آمار گروهی برای مدیر */
export async function groupStats(filter: { grade?: string; major?: string; classGroupId?: string }) {
  const where = {
    role: "USER" as const,
    ...(filter.grade ? { grade: filter.grade } : {}),
    ...(filter.major ? { major: filter.major } : {}),
    ...(filter.classGroupId ? { classGroupId: filter.classGroupId, classStatus: "APPROVED" as const } : {}),
  };
  const users = await db.user.findMany({ where, select: { id: true, name: true, phone: true, points: true, grade: true, major: true, lastSeenAt: true } });
  const ids = users.map((u) => u.id);
  const today = tehranDay();
  const from = addDays(today, -29);
  const [acts, results, progress] = await Promise.all([
    db.activity.findMany({ where: { userId: { in: ids }, day: { gte: from } } }),
    db.examResult.findMany({ where: { userId: { in: ids }, status: "SUBMITTED" }, include: { exam: { select: { title: true, maxScore: true, createdAt: true } } } }),
    db.videoProgress.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _sum: { watchedSeconds: true } }),
  ]);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(from, i);
    const a = acts.filter((x) => x.day === d);
    return { day: d, active: a.length, videoMin: Math.round(a.reduce((s, x) => s + x.videoSec, 0) / 60) };
  });
  const examMap = new Map<string, { title: string; date: Date; values: number[] }>();
  for (const r of results) {
    const p = resultPercent(r, r.exam.maxScore);
    if (p === null) continue;
    const e = examMap.get(r.examId) ?? { title: r.exam.title, date: r.exam.createdAt, values: [] };
    e.values.push(p);
    examMap.set(r.examId, e);
  }
  const exams = [...examMap.entries()]
    .map(([id, e]) => ({ id, title: e.title, date: e.date.toISOString(), avg: avg(e.values)!, max: Math.max(...e.values), count: e.values.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const watch = new Map(progress.map((p) => [p.userId, p._sum.watchedSeconds ?? 0]));
  const perUser = new Map<string, number[]>();
  for (const r of results) {
    const p = resultPercent(r, r.exam.maxScore);
    if (p !== null) perUser.set(r.userId, [...(perUser.get(r.userId) ?? []), p]);
  }
  const week = addDays(today, -6);
  const top = users
    .map((u) => ({ ...u, watchSec: watch.get(u.id) ?? 0, avgPercent: avg(perUser.get(u.id) ?? []), exams: perUser.get(u.id)?.length ?? 0 }))
    .sort((a, b) => b.points - a.points);
  return {
    members: users.length,
    active7: new Set(acts.filter((a) => a.day >= week).map((a) => a.userId)).size,
    avgPercent: avg(results.map((r) => resultPercent(r, r.exam.maxScore)).filter((x): x is number => x !== null)),
    totalWatchSec: [...watch.values()].reduce((a, b) => a + b, 0),
    days,
    exams,
    top,
  };
}
