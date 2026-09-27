import { Form, Submit } from "./Form";
import { Field } from "./ui";
import { saveTopic } from "@/app/admin/topics/actions";
import { GRADES, MAJORS } from "@/lib/constants";

type T = { id: string; title: string; description: string | null; grade: string; majors: string[]; price: number; order: number; published: boolean; cover: string | null };

export function TopicForm({ t }: { t?: T }) {
  return (
    <Form action={saveTopic} reset={!t} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="id" value={t?.id ?? ""} />
      <Field label="عنوان مبحث" className="sm:col-span-2"><input name="title" defaultValue={t?.title} className="input" required /></Field>
      <Field label="پایه"><select name="grade" defaultValue={t?.grade ?? "G12"} className="input">{GRADES.filter((g) => g.value !== "GRAD").map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}<option value="ALL">جامع / همه پایه‌ها</option></select></Field>
      <Field label="قیمت (تومان) — ۰ یعنی فروش تکی ندارد"><input name="price" defaultValue={t?.price ?? 0} className="input" inputMode="numeric" /></Field>
      <Field label="توضیحات" className="sm:col-span-4"><textarea name="description" defaultValue={t?.description ?? ""} rows={2} className="input" /></Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <span className="text-xs text-white/55">رشته:</span>
        {MAJORS.map((m) => <label key={m.value} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="majors" value={m.value} defaultChecked={t ? t.majors.includes(m.value) : true} className="size-4" /> {m.label}</label>)}
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="published" defaultChecked={t?.published ?? true} className="size-4" /> منتشر شده</label>
      </div>
      <Field label="ترتیب"><input name="order" defaultValue={t?.order ?? 0} className="input" inputMode="numeric" /></Field>
      <Field label="تصویر کاور"><input name="cover" type="file" accept="image/*" className="input !py-2 text-xs" /></Field>
      <Submit className="btn-primary sm:col-span-4">{t ? "ذخیره مبحث" : "افزودن مبحث"}</Submit>
    </Form>
  );
}
