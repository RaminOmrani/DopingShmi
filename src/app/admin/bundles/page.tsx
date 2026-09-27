import { db } from "@/lib/db";
import { PageHead, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { saveBundle, deleteBundle } from "../topics/actions";
import { gradeLabel } from "@/lib/constants";
import { faNum, fmtToman } from "@/lib/utils";

export const metadata = { title: "بسته‌های فروش" };

type Topic = { id: string; title: string; grade: string };
type B = { id: string; title: string; description: string | null; price: number; durationDays: number | null; active: boolean; order: number; topics: { id: string }[] };

export default async function Bundles() {
  const [bundles, topics] = await Promise.all([
    db.bundle.findMany({ orderBy: { order: "asc" }, include: { topics: { select: { id: true } }, _count: { select: { purchases: true } } } }),
    db.topic.findMany({ orderBy: [{ grade: "asc" }, { order: "asc" }], select: { id: true, title: true, grade: true } }),
  ]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title="بسته‌های جامع" desc="چند مبحث را با هم و با قیمت ویژه بفروشید (مثلاً «جامع دوازدهم» یا «کل شیمی کنکور»). خرید تکی هر مبحث از صفحه‌ی همان مبحث تنظیم می‌شود." />
      <div className="mb-6 grid gap-4">
        {bundles.map((b) => (
          <details key={b.id} className="card p-5">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3"><span className="font-black">{b.title}</span><span className="text-sm text-cyan">{fmtToman(b.price)}</span><span className="text-xs text-white/45">{faNum(b.topics.length)} مبحث · {faNum(b._count.purchases)} خرید{b.active ? "" : " · غیرفعال"}</span></summary>
            <div className="mt-4"><BundleForm b={b} topics={topics} /></div>
            <Form action={deleteBundle} confirm="بسته حذف شود؟" className="mt-2"><input type="hidden" name="id" value={b.id} /><Submit className="btn-danger btn-sm">حذف</Submit></Form>
          </details>
        ))}
      </div>
      <section className="card p-5"><h2 className="mb-4 font-black">بسته جدید</h2><BundleForm topics={topics} /></section>
    </div>
  );
}

function BundleForm({ b, topics }: { b?: B; topics: Topic[] }) {
  const has = new Set(b?.topics.map((t) => t.id));
  return (
    <Form action={saveBundle} reset={!b} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="id" value={b?.id ?? ""} />
      <Field label="عنوان" className="sm:col-span-2"><input name="title" defaultValue={b?.title} className="input" required /></Field>
      <Field label="قیمت (تومان)"><input name="price" defaultValue={b?.price} className="input" inputMode="numeric" required /></Field>
      <Field label="مدت دسترسی (روز) — خالی = دائمی"><input name="durationDays" defaultValue={b?.durationDays ?? ""} className="input" inputMode="numeric" /></Field>
      <Field label="توضیحات" className="sm:col-span-4"><textarea name="description" defaultValue={b?.description ?? ""} rows={2} className="input" /></Field>
      <div className="grid gap-1.5 rounded-2xl bg-white/[.03] p-3 sm:col-span-4 sm:grid-cols-2">
        {topics.map((t) => <label key={t.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="topics" value={t.id} defaultChecked={has.has(t.id)} className="size-4" /> <span className="text-white/45">{gradeLabel(t.grade)}</span> {t.title}</label>)}
      </div>
      <Field label="ترتیب"><input name="order" defaultValue={b?.order ?? 0} className="input" /></Field>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="active" defaultChecked={b?.active ?? true} className="size-4" /> فعال</label>
      <Submit className="btn-primary sm:col-span-2">{b ? "ذخیره" : "ساخت بسته"}</Submit>
    </Form>
  );
}
