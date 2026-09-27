"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Form, Submit } from "./Form";
import { Field } from "./ui";
import { saveExam } from "@/app/admin/exams/actions";
import { GRADES, MAJORS } from "@/lib/constants";

export interface ExamInit {
  id?: string; title: string; description: string; kind: string; externalUrl: string; openMode: string; grade: string; major: string; audience: string; classGroupId: string;
  durationMin: number; startAt: string; endAt: string; negative: boolean; showAnswers: boolean; maxScore: number; published: boolean;
}

export function ExamForm({ init, groups }: { init: ExamInit; groups: { id: string; name: string }[] }) {
  const [kind, setKind] = useState(init.kind);
  const [aud, setAud] = useState(init.audience);
  const router = useRouter();
  return (
    <Form action={saveExam} className="grid gap-3 sm:grid-cols-4" onDone={(r) => { if (r?.ok && !init.id && typeof r.data === "string") router.push(`/admin/exams/${r.data}`); }}>
      <input type="hidden" name="id" value={init.id ?? ""} />
      <div className="flex gap-2 sm:col-span-4">
        {[["INTERNAL", "آزمون داخل سایت (تستی)"], ["EXTERNAL", "آزمون پلکان (لینک بیرونی)"]].map(([k, l]) => (
          <label key={k} className={`btn btn-sm cursor-pointer ${kind === k ? "btn-primary" : "btn-ghost"}`}><input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="hidden" /> {l}</label>
        ))}
      </div>
      <Field label="عنوان آزمون" className="sm:col-span-2"><input name="title" defaultValue={init.title} className="input" required /></Field>
      <Field label="پایه"><select name="grade" defaultValue={init.grade} className="input"><option value="">همه</option>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></Field>
      <Field label="رشته"><select name="major" defaultValue={init.major} className="input"><option value="">همه</option>{MAJORS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></Field>
      {kind === "EXTERNAL" && (
        <>
          <Field label="لینک آزمون در پلکان" className="sm:col-span-2"><input name="externalUrl" defaultValue={init.externalUrl} className="input" dir="ltr" placeholder="https://peleyad.com/..." required /></Field>
          <Field label="نحوه‌ی باز شدن"><select name="openMode" defaultValue={init.openMode} className="input"><option value="TAB">صفحه‌ی جدید (پیشنهادی)</option><option value="IFRAME">داخل سایت (اگر پلکان اجازه دهد)</option></select></Field>
          <Field label="حداکثر نمره (برای نمره‌ی خام)"><input name="maxScore" defaultValue={init.maxScore} className="input" inputMode="numeric" /></Field>
        </>
      )}
      <Field label="مخاطب"><select name="audience" value={aud} onChange={(e) => setAud(e.target.value)} className="input"><option value="STUDENTS">فقط شاگردان کلاس</option><option value="GROUP">یک کلاس خاص</option><option value="ALL">همه‌ی کاربران (حتی غیرشاگرد)</option></select></Field>
      {aud === "GROUP" && <Field label="کلاس"><select name="classGroupId" defaultValue={init.classGroupId} className="input" required><option value="">انتخاب</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>}
      <Field label="شروع (شمسی، اختیاری)"><input name="startAt" defaultValue={init.startAt} className="input" dir="ltr" placeholder="1405/07/10 16:00" /></Field>
      <Field label="پایان (شمسی، اختیاری)"><input name="endAt" defaultValue={init.endAt} className="input" dir="ltr" placeholder="1405/07/12 23:59" /></Field>
      {kind === "INTERNAL" && <Field label="مدت (دقیقه)"><input name="durationMin" defaultValue={init.durationMin} className="input" inputMode="numeric" /></Field>}
      <Field label="توضیحات" className="sm:col-span-4"><textarea name="description" defaultValue={init.description} rows={2} className="input" /></Field>
      <div className="flex flex-wrap gap-4 text-sm sm:col-span-4">
        {kind === "INTERNAL" && <label className="flex items-center gap-2"><input type="checkbox" name="negative" defaultChecked={init.negative} className="size-4" /> نمره منفی (کنکوری)</label>}
        {kind === "INTERNAL" && <label className="flex items-center gap-2"><input type="checkbox" name="showAnswers" defaultChecked={init.showAnswers} className="size-4" /> نمایش پاسخ تشریحی بعد از آزمون</label>}
        <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={init.published} className="size-4 accent-lime-400" /> منتشر شده (برای دانش‌آموزان قابل مشاهده)</label>
        {!init.published && <label className="flex items-center gap-2"><input type="checkbox" name="notify" className="size-4" /> هنگام انتشار پیامک «آزمون جدید» ارسال شود</label>}
      </div>
      <Submit className="btn-primary sm:col-span-4">{init.id ? "ذخیره تنظیمات" : "ساخت آزمون"}</Submit>
    </Form>
  );
}
