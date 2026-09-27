import Link from "next/link";
import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/ui";
import { TopicForm } from "@/components/admin/TopicForm";
import { gradeLabel } from "@/lib/constants";
import { faNum, fmtToman } from "@/lib/utils";
import { Gift, EyeOff, ChevronLeft } from "lucide-react";

export const metadata = { title: "مباحث و ویدیوها" };

export default async function Topics() {
  const topics = await db.topic.findMany({ orderBy: [{ grade: "asc" }, { order: "asc" }], include: { videos: { select: { id: true, isFree: true, arvanVideoId: true } }, _count: { select: { purchases: true } } } });
  const grades = ["G10", "G11", "G12", "ALL"];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="مباحث و ویدیوها" desc="ویدیوها را در پنل آروان (پلتفرم ویدیو) آپلود کنید و شناسه‌ی هر ویدیو را اینجا ثبت کنید. از هر مبحث یک جلسه را «رایگان» علامت بزنید." />
      {grades.map((g) => {
        const list = topics.filter((t) => t.grade === g);
        if (!list.length) return null;
        return (
          <section key={g} className="mb-6">
            <h2 className="mb-3 font-black">شیمی {gradeLabel(g)}</h2>
            <div className="grid gap-2">
              {list.map((t) => (
                <Link key={t.id} href={`/admin/topics/${t.id}`} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-cyan/30">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{t.title} {!t.published && <EyeOff className="inline size-4 text-white/40" />}</p>
                    <p className="text-xs text-white/50">{faNum(t.videos.length)} ویدیو · {faNum(t.videos.filter((v) => !v.arvanVideoId).length)} بدون فایل · {t.price ? fmtToman(t.price) : "بدون فروش تکی"} · {faNum(t._count.purchases)} خرید</p>
                  </div>
                  {t.videos.some((v) => v.isFree) ? <span className="chip !text-lime"><Gift className="size-3" /> رایگان دارد</span> : <span className="chip !text-amber">جلسه رایگان ندارد</span>}
                  <ChevronLeft className="size-4 text-white/40" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      <section className="card p-5">
        <h2 className="mb-4 font-black">افزودن مبحث جدید</h2>
        <TopicForm />
      </section>
    </div>
  );
}
