import Link from "next/link";
import { Film, CheckCircle2, AlertTriangle, Loader2, Download, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { arvanClient } from "@/lib/arvan";
import type { ArvanListVideo } from "@/lib/arvan-api";
import { PageHead, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { attachArvanVideo, clearImports } from "./actions";
import { gradeLabel } from "@/lib/constants";
import { faNum, fmtClock } from "@/lib/utils";

export const metadata = { title: "ویدیوهای آروان" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { t: string; c: string }> = {
  complete: { t: "آماده", c: "!text-lime" },
  converting: { t: "در حال تبدیل", c: "!text-amber" },
  queue: { t: "در صف تبدیل", c: "!text-amber" },
  queued: { t: "در صف تبدیل", c: "!text-amber" },
  uploading: { t: "در حال آپلود", c: "!text-amber" },
  failed: { t: "خطای تبدیل", c: "!text-rose" },
};
const gb = (n: number) => `${faNum((n / 1024 ** 3).toFixed(1))} گیگ`;

export default async function ArvanVideos() {
  const [imports, topics, linked] = await Promise.all([
    db.videoImport.findMany({ orderBy: { createdAt: "asc" } }),
    db.topic.findMany({ orderBy: [{ grade: "asc" }, { order: "asc" }], select: { id: true, title: true, grade: true } }),
    db.video.findMany({ where: { arvanVideoId: { not: null } }, select: { arvanVideoId: true } }),
  ]);
  const linkedIds = new Set(linked.map((v) => v.arvanVideoId));

  let all: ArvanListVideo[] = [];
  let error = "";
  try {
    const api = await arvanClient();
    for (const ch of await api.channels()) all.push(...(await api.videos(ch.id)));
  } catch (e) {
    error = (e as Error).message;
  }
  all = all.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  const unlinked = all.filter((v) => !linkedIds.has(v.id));

  const done = imports.filter((r) => r.status === "DONE");
  const active = imports.filter((r) => r.status === "DOWNLOADING" || r.status === "UPLOADING");
  const failed = imports.filter((r) => r.status === "FAILED");
  const total = imports.reduce((a, r) => a + r.size, 0);
  const doneSize = done.reduce((a, r) => a + r.size, 0);
  const grades = ["G10", "G11", "G12", "ALL"];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="ویدیوهای آروان" desc="ویدیوهایی که در کانال آروان هستند ولی هنوز به هیچ مبحثی وصل نشده‌اند. برای هر کدام مبحث و عنوان را انتخاب کنید تا در سایت نمایش داده شود.">
        <Link href="/admin/topics" className="btn-ghost btn-sm">مباحث و ویدیوها</Link>
      </PageHead>

      {imports.length > 0 && (
        <section className="card mb-6 p-5">
          {active.length > 0 && <AutoRefresh seconds={15} />}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-black"><Download className="size-5 text-cyan" /> انتقال از تلگرام</h2>
            <p className="text-sm text-white/60">{faNum(done.length)} از {faNum(imports.length)} ویدیو · {gb(doneSize)} از {gb(total)}</p>
          </div>
          <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-l from-cyan to-violet transition-all" style={{ width: `${total ? Math.round((doneSize / total) * 100) : 0}%` }} />
          </div>
          {active.map((r) => (
            <p key={r.id} className="mb-2 flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin text-amber" />
              {r.status === "DOWNLOADING" ? <Download className="size-4 text-white/50" /> : <Upload className="size-4 text-white/50" />}
              <span className="font-bold">{r.title}</span>
              <span className="text-white/55">— {r.status === "DOWNLOADING" ? "دانلود از تلگرام" : "ارسال به آروان"} {faNum(r.progress)}٪</span>
            </p>
          ))}
          {failed.map((r) => (
            <p key={r.id} className="mb-2 flex items-start gap-2 text-sm text-rose">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span><b>{r.title}</b>: {r.error}</span>
            </p>
          ))}
          {!active.length && done.length === imports.length && <p className="flex items-center gap-2 text-sm text-lime"><CheckCircle2 className="size-4" /> همه‌ی ویدیوها منتقل شد. نشست تلگرام را روی سرور ببندید: <code dir="ltr" className="rounded bg-white/10 px-1.5">pnpm tg logout</code></p>}
          {!active.length && (
            <Form action={clearImports} confirm="گزارش انتقال پاک شود؟ (ویدیوها دست نمی‌خورند)" className="mt-3">
              <Submit className="btn-ghost btn-sm">پاک کردن گزارش</Submit>
            </Form>
          )}
        </section>
      )}

      {error ? (
        <div className="card p-8 text-center text-white/60">
          <AlertTriangle className="mx-auto mb-3 size-8 text-amber" />
          {error}
          <p className="mt-3"><Link href="/admin/settings" className="text-cyan hover:underline">تنظیمات آروان</Link></p>
        </div>
      ) : unlinked.length === 0 ? (
        <div className="card p-10 text-center text-white/55">
          <Film className="mx-auto mb-3 size-8 text-white/30" />
          {all.length ? `همه‌ی ${faNum(all.length)} ویدیوی آروان به مباحث وصل شده‌اند.` : "هنوز ویدیویی در کانال آروان نیست."}
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-white/55">{faNum(unlinked.length)} ویدیو منتظر انتخاب مبحث · {faNum(all.length - unlinked.length)} ویدیو قبلاً وصل شده</p>
          <div className="grid gap-3">
            {unlinked.map((v, i) => {
              const st = STATUS[v.status] ?? { t: v.status || "—", c: "" };
              return (
                <Form key={v.id} action={attachArvanVideo} className="card grid items-end gap-3 p-4 md:grid-cols-[96px_1fr_1fr_auto]">
                  <input type="hidden" name="arvanVideoId" value={v.id} />
                  <input type="hidden" name="arvanTitle" value={v.title} />
                  <input type="hidden" name="duration" value={v.duration} />
                  <input type="hidden" name="thumbnail" value={v.thumbnail ?? ""} />
                  <div className="relative hidden aspect-video overflow-hidden rounded-xl bg-white/5 md:block">
                    {v.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <Film className="absolute inset-0 m-auto size-6 text-white/30" />
                    )}
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px]">{faNum(i + 1)}</span>
                  </div>
                  <Field label={`عنوان در سایت · ${v.duration ? fmtClock(v.duration) : "مدت نامشخص"}`}>
                    <input name="title" defaultValue={v.title} className="input" required />
                  </Field>
                  <Field label="مبحث">
                    <select name="topicId" className="input" required defaultValue="">
                      <option value="" disabled>انتخاب مبحث…</option>
                      {grades.map((g) => {
                        const list = topics.filter((t) => t.grade === g);
                        return list.length ? (
                          <optgroup key={g} label={`شیمی ${gradeLabel(g)}`}>
                            {list.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                          </optgroup>
                        ) : null;
                      })}
                    </select>
                  </Field>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`chip ${st.c}`}>{st.t}</span>
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="isFree" className="size-4" /> رایگان</label>
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="published" defaultChecked className="size-4" /> نمایش</label>
                    <Submit className="btn-primary btn-sm">افزودن</Submit>
                  </div>
                </Form>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
