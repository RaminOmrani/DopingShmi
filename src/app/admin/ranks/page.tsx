import { db } from "@/lib/db";
import { PageHead, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { saveRank, deleteRank } from "../photos/actions";
import { faNum } from "@/lib/utils";

export const metadata = { title: "رتبه‌های برتر" };
type R = { id: string; name: string; rank: number; year: string; field: string | null; photo: string | null; note: string | null; order: number };

export default async function Ranks() {
  const ranks = await db.topRank.findMany({ orderBy: [{ order: "asc" }, { rank: "asc" }] });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="رتبه‌های برتر" desc="کارت‌های رتبه‌ها در بخش «رتبه‌های برتر» صفحه‌ی اصلی نمایش داده می‌شوند." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {ranks.map((r) => (
          <details key={r.id} className="card p-4">
            <summary className="flex cursor-pointer items-center gap-3">
              {r.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.photo} alt="" className="size-10 rounded-xl object-cover" />
              ) : <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-xs">—</span>}
              <span className="font-bold">{r.name}</span><span className="text-sm text-amber">رتبه {faNum(r.rank)}</span><span className="text-xs text-white/45">{faNum(r.year)}</span>
            </summary>
            <div className="mt-4"><RankForm r={r} /></div>
            <Form action={deleteRank} confirm="حذف شود؟" className="mt-2"><input type="hidden" name="id" value={r.id} /><Submit className="btn-danger btn-sm">حذف</Submit></Form>
          </details>
        ))}
      </div>
      <section className="card p-5"><h2 className="mb-4 font-black">افزودن رتبه</h2><RankForm /></section>
    </div>
  );
}

function RankForm({ r }: { r?: R }) {
  return (
    <Form action={saveRank} reset={!r} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="id" value={r?.id ?? ""} />
      <Field label="نام"><input name="name" defaultValue={r?.name} className="input" required /></Field>
      <Field label="رتبه"><input name="rank" defaultValue={r?.rank} className="input" inputMode="numeric" required /></Field>
      <Field label="سال کنکور"><input name="year" defaultValue={r?.year ?? "1404"} className="input" required /></Field>
      <Field label="رشته / منطقه"><input name="field" defaultValue={r?.field ?? ""} className="input" placeholder="تجربی · منطقه ۲" /></Field>
      <Field label="عکس"><input type="file" name="photo" accept="image/*" className="input !py-2 text-xs" /></Field>
      <Field label="ترتیب"><input name="order" defaultValue={r?.order ?? 0} className="input" /></Field>
      <Field label="یادداشت (اختیاری)" className="sm:col-span-3"><input name="note" defaultValue={r?.note ?? ""} className="input" /></Field>
      <Submit className="btn-primary sm:col-span-3">{r ? "ذخیره" : "افزودن"}</Submit>
    </Form>
  );
}
