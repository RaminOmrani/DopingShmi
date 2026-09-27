import Link from "next/link";
import { Crown, Medal } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { groupLabel } from "@/lib/constants";
import { LevelBadge } from "@/components/panel/LevelBadge";
import { addDays, fmtInt, faNum, tehranDay } from "@/lib/utils";

export const metadata = { title: "رتبه‌بندی" };

const shortName = (n: string) => {
  const [a, ...rest] = n.trim().split(/\s+/);
  return rest.length ? `${a} ${rest[rest.length - 1][0]}.` : a || "دانش‌آموز";
};

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const user = await requireUser();
  const t = (await searchParams).t ?? "group";
  let rows: { id: string; name: string; points: number; total: number }[] = [];
  if (t === "week") {
    const from = addDays(tehranDay(), -6);
    const g = await db.activity.groupBy({ by: ["userId"], where: { day: { gte: from }, user: { role: "USER", grade: user.grade, major: user.major } }, _sum: { points: true }, orderBy: { _sum: { points: "desc" } }, take: 50 });
    const us = await db.user.findMany({ where: { id: { in: g.map((x) => x.userId) } }, select: { id: true, name: true, points: true } });
    const m = new Map(us.map((u) => [u.id, u]));
    rows = g.map((x) => ({ id: x.userId, name: m.get(x.userId)?.name ?? "", points: x._sum.points ?? 0, total: m.get(x.userId)?.points ?? 0 }));
  } else {
    const us = await db.user.findMany({
      where: { role: "USER", blocked: false, ...(t === "group" ? { grade: user.grade, major: user.major } : {}) },
      orderBy: { points: "desc" },
      take: 50,
      select: { id: true, name: true, points: true },
    });
    rows = us.map((u) => ({ ...u, total: u.points }));
  }
  const myIdx = rows.findIndex((r) => r.id === user.id);
  const tabs = [
    { k: "group", l: `گروه من (${groupLabel(user.grade, user.major)})` },
    { k: "week", l: "این هفته" },
    { k: "all", l: "همه" },
  ];
  const podium = rows.slice(0, 3);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-black">رتبه‌بندی</h1>
      <p className="mb-5 text-sm text-white/55">با دیدن ویدیو، شرکت در آزمون و حضور روزانه امتیاز بگیر و بالا برو 🚀</p>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
        {tabs.map((x) => <Link key={x.k} href={`?t=${x.k}`} className={`btn btn-sm shrink-0 ${t === x.k ? "btn-primary" : "btn-ghost"}`}>{x.l}</Link>)}
      </div>

      {podium.length >= 3 && (
        <div className="mb-6 grid grid-cols-3 items-end gap-3">
          {[podium[1], podium[0], podium[2]].map((p, i) => {
            const place = [2, 1, 3][i];
            return (
              <div key={p.id} className={`card relative p-4 text-center ${place === 1 ? "glow-border pb-8 pt-8" : ""}`}>
                {place === 1 ? <Crown className="mx-auto mb-2 size-8 text-amber" /> : <Medal className={`mx-auto mb-2 size-6 ${place === 2 ? "text-slate-300" : "text-orange-400"}`} />}
                <div className="mb-2 flex justify-center"><LevelBadge points={p.total} size={place === 1 ? "md" : "sm"} /></div>
                <p className="truncate text-sm font-black">{p.id === user.id ? "شما" : shortName(p.name)}</p>
                <p className="text-xs text-white/55">{fmtInt(p.points)} امتیاز</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="card divide-y divide-white/5 overflow-hidden">
        {rows.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.id === user.id ? "bg-gradient-to-l from-cyan/15 to-violet/10" : ""}`}>
            <span className="w-7 text-center text-sm font-black text-white/60">{faNum(i + 1)}</span>
            <LevelBadge points={r.total} size="sm" />
            <span className="flex-1 truncate text-sm font-bold">{r.id === user.id ? `${user.name} (شما)` : shortName(r.name)}</span>
            <span className="text-sm font-black text-gradient">{fmtInt(r.points)}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="p-8 text-center text-sm text-white/50">هنوز امتیازی ثبت نشده است.</p>}
      </div>
      {myIdx === -1 && <p className="mt-4 text-center text-xs text-white/45">شما هنوز در ۵۰ نفر اول این فهرست نیستید؛ ادامه بده! 💪</p>}
    </div>
  );
}
