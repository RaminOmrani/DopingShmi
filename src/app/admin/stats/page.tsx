import Link from "next/link";
import { db } from "@/lib/db";
import { groupStats } from "@/lib/stats";
import { PageHead, Kpi } from "@/components/admin/ui";
import { ExamAvgBars, DailyBars } from "@/components/charts/Charts";
import { GRADES, MAJORS, groupLabel } from "@/lib/constants";
import { faNum, fmtDate, fmtDayShort, fmtDuration, fmtInt, fmtPct } from "@/lib/utils";

export const metadata = { title: "آمار گروهی" };

export default async function Stats({ searchParams }: { searchParams: Promise<{ grade?: string; major?: string; group?: string }> }) {
  const sp = await searchParams;
  const [s, groups] = await Promise.all([groupStats({ grade: sp.grade, major: sp.major, classGroupId: sp.group }), db.classGroup.findMany({ orderBy: { order: "asc" } })]);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHead title="آمار گروهی" desc="عملکرد هر پایه، رشته یا کلاس؛ مقایسه‌ی آزمون‌ها و فعالیت روزانه" />
      <form className="card mb-5 grid gap-2 p-3 sm:grid-cols-4">
        <select name="grade" defaultValue={sp.grade ?? ""} className="input"><option value="">همه پایه‌ها</option>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
        <select name="major" defaultValue={sp.major ?? ""} className="input"><option value="">همه رشته‌ها</option>{MAJORS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
        <select name="group" defaultValue={sp.group ?? ""} className="input"><option value="">همه کلاس‌ها</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <button className="btn-primary">نمایش</button>
      </form>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="تعداد اعضا" value={fmtInt(s.members)} />
        <Kpi label="فعال ۷ روز اخیر" value={fmtInt(s.active7)} sub={s.members ? `${faNum(Math.round((s.active7 / s.members) * 100))}٪ اعضا` : ""} />
        <Kpi label="میانگین درصد آزمون‌ها" value={fmtPct(s.avgPercent)} />
        <Kpi label="مجموع تماشا" value={<span className="text-lg">{fmtDuration(s.totalWatchSec)}</span>} />
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5"><h2 className="mb-3 font-black">میانگین و بیشترین درصد هر آزمون</h2>{s.exams.length ? <ExamAvgBars data={s.exams.map((e) => ({ name: e.title, avg: Math.round(e.avg * 10) / 10, max: Math.round(e.max * 10) / 10 }))} /> : <p className="text-sm text-white/45">آزمونی ثبت نشده</p>}</section>
        <section className="card p-5"><h2 className="mb-3 font-black">اعضای فعال در هر روز</h2><DailyBars data={s.days.map((d) => ({ label: fmtDayShort(d.day), v: d.active }))} dataKey="v" name="فعال" height={260} /></section>
      </div>
      <section className="card p-5">
        <h2 className="mb-3 font-black">جدول اعضا ({groupLabel(sp.grade, sp.major)})</h2>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>#</th><th>نام</th><th>گروه</th><th>امتیاز</th><th>آزمون‌ها</th><th>میانگین درصد</th><th>تماشا</th><th>آخرین حضور</th></tr></thead>
          <tbody>{s.top.map((u, i) => (
            <tr key={u.id}><td>{faNum(i + 1)}</td><td><Link href={`/admin/users/${u.id}`} className="font-bold hover:text-cyan">{u.name || u.phone}</Link></td><td className="text-xs">{groupLabel(u.grade, u.major)}</td><td className="font-bold">{fmtInt(u.points)}</td><td>{faNum(u.exams)}</td><td>{fmtPct(u.avgPercent)}</td><td className="text-xs">{fmtDuration(u.watchSec)}</td><td className="text-xs text-white/50">{fmtDate(u.lastSeenAt)}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
    </div>
  );
}
