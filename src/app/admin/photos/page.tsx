import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { PhotoUploader } from "@/components/admin/PhotoUploader";
import { updatePhoto, deletePhoto } from "./actions";
import { faNum } from "@/lib/utils";

export const metadata = { title: "عکس‌ها" };
const SECTIONS: Record<string, string> = { CONFERENCE: "همایش", GALLERY: "گالری", TEACHER: "عکس استاد" };

export default async function Photos({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const s = (await searchParams).s ?? "";
  const photos = await db.photo.findMany({ where: s ? { section: s } : {}, orderBy: [{ section: "asc" }, { order: "asc" }] });
  return (
    <div className="mx-auto max-w-7xl">
      <PageHead title="عکس‌ها و همایش‌ها" desc="عکس‌های «همایش» در نوار سینمایی بالای صفحه‌ی اصلی و گالری نمایش داده می‌شوند. برای عکس استاد، ترجیحاً PNG با پس‌زمینه‌ی شفاف (دوربری‌شده) بفرستید." />
      <section className="card glow-border mb-6 p-5"><PhotoUploader /></section>
      <div className="mb-4 flex gap-2">
        {[["", "همه"], ...Object.entries(SECTIONS)].map(([k, l]) => <a key={k} href={`?s=${k}`} className={`btn btn-sm ${s === k ? "btn-primary" : "btn-ghost"}`}>{l}</a>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className={`card overflow-hidden ${p.visible ? "" : "opacity-50"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbUrl || p.url} alt="" className="h-44 w-full bg-white/5 object-cover" loading="lazy" />
            <Form action={updatePhoto} className="grid gap-2 p-3">
              <input type="hidden" name="id" value={p.id} />
              <input name="title" defaultValue={p.title ?? ""} className="input !py-2 text-xs" placeholder="عنوان" />
              <input name="eventName" defaultValue={p.eventName ?? ""} className="input !py-2 text-xs" placeholder="نام همایش" />
              <div className="flex gap-2">
                <select name="section" defaultValue={p.section} className="input !py-2 text-xs">{Object.entries(SECTIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <input name="order" defaultValue={p.order} className="input !w-16 !py-2 text-center text-xs" title="ترتیب" />
              </div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="visible" defaultChecked={p.visible} /> نمایش در سایت</label>
              <Submit className="btn-ghost btn-sm">ذخیره</Submit>
            </Form>
            <Form action={deletePhoto} confirm="عکس حذف شود؟" className="px-3 pb-3"><input type="hidden" name="id" value={p.id} /><Submit className="btn-danger btn-sm w-full">حذف</Submit></Form>
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="text-center text-sm text-white/45">عکسی بارگذاری نشده ({faNum(0)})</p>}
    </div>
  );
}
