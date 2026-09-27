import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Gift, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { PageHead, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { TopicForm } from "@/components/admin/TopicForm";
import { saveVideo, deleteVideo, deleteTopic } from "../actions";
import { faNum, fmtClock } from "@/lib/utils";

type V = { id: string; title: string; description: string | null; arvanVideoId: string | null; durationSec: number; isFree: boolean; order: number; published: boolean };

const dur = (s: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "");

export default async function TopicAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.topic.findUnique({ where: { id }, include: { videos: { orderBy: { order: "asc" }, include: { _count: { select: { progress: true } } } } } });
  if (!t) notFound();
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/topics" className="mb-3 inline-flex items-center gap-1 text-sm text-white/50 hover:text-cyan"><ArrowRight className="size-4" /> مباحث</Link>
      <PageHead title={t.title} desc={`${faNum(t.videos.length)} ویدیو`}>
        <Link href={`/courses/${t.id}`} className="btn-ghost btn-sm" target="_blank">مشاهده در سایت</Link>
      </PageHead>
      <details className="card mb-5 p-5"><summary className="cursor-pointer font-black">ویرایش مبحث</summary><div className="mt-4"><TopicForm t={t} /></div>
        <Form action={deleteTopic} confirm="مبحث و همه‌ی ویدیوهایش حذف شود؟" className="mt-3"><input type="hidden" name="id" value={t.id} /><Submit className="btn-danger btn-sm">حذف مبحث</Submit></Form>
      </details>

      <h2 className="mb-3 font-black">ویدیوها</h2>
      <div className="mb-6 grid gap-3">
        {t.videos.map((v) => (
          <details key={v.id} className="card p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="font-bold">{faNum(v.order)}. {v.title}</span>
              <span className="text-xs text-white/45">{fmtClock(v.durationSec)} · {faNum(v._count.progress)} بیننده</span>
              {v.isFree && <span className="chip !text-lime"><Gift className="size-3" /> رایگان</span>}
              {!v.arvanVideoId && <span className="chip !text-amber"><AlertTriangle className="size-3" /> شناسه ویدیو ثبت نشده</span>}
              {!v.published && <span className="chip">پیش‌نویس</span>}
            </summary>
            <div className="mt-4"><VideoForm topicId={t.id} v={v} /></div>
            <Form action={deleteVideo} confirm="ویدیو حذف شود؟" className="mt-2"><input type="hidden" name="id" value={v.id} /><input type="hidden" name="topicId" value={t.id} /><Submit className="btn-danger btn-sm">حذف ویدیو</Submit></Form>
          </details>
        ))}
        {t.videos.length === 0 && <p className="text-sm text-white/45">هنوز ویدیویی اضافه نشده.</p>}
      </div>
      <section className="card glow-border p-5">
        <h2 className="mb-4 font-black">افزودن ویدیو</h2>
        <VideoForm topicId={t.id} nextOrder={t.videos.length + 1} />
      </section>
    </div>
  );
}

function VideoForm({ topicId, v, nextOrder }: { topicId: string; v?: V; nextOrder?: number }) {
  return (
    <Form action={saveVideo} reset={!v} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="id" value={v?.id ?? ""} />
      <input type="hidden" name="topicId" value={topicId} />
      <Field label="عنوان جلسه" className="sm:col-span-2"><input name="title" defaultValue={v?.title} className="input" required /></Field>
      <Field label="شناسه ویدیو در آروان (Video ID)" className="sm:col-span-2"><input name="arvanVideoId" defaultValue={v?.arvanVideoId ?? ""} className="input" dir="ltr" placeholder="مثلاً 3f2a...  یا لینک مستقیم m3u8" /></Field>
      <Field label="مدت (دقیقه:ثانیه) — خالی = خودکار از آروان"><input name="duration" defaultValue={dur(v?.durationSec ?? 0)} className="input" dir="ltr" placeholder="45:30" /></Field>
      <Field label="ترتیب"><input name="order" defaultValue={v?.order ?? nextOrder ?? 0} className="input" inputMode="numeric" /></Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="isFree" defaultChecked={v?.isFree} className="size-4 accent-lime-400" /> رایگان (نمونه)</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="published" defaultChecked={v?.published ?? true} className="size-4" /> منتشر شود</label>
        {!v && <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="notify" className="size-4" /> پیامک «ویدیو جدید» به شاگردان</label>}
      </div>
      <Field label="توضیحات" className="sm:col-span-4"><textarea name="description" defaultValue={v?.description ?? ""} rows={2} className="input" /></Field>
      <Submit className="btn-primary sm:col-span-4">{v ? "ذخیره" : "افزودن ویدیو"}</Submit>
    </Form>
  );
}
