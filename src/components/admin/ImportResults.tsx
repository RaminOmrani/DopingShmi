"use client";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { parseResultsFile, importResults } from "@/app/admin/exams/actions";

type Parsed = { headers: string[]; rows: string[][] };

const guess = (headers: string[], words: string[]) => headers.findIndex((h) => words.some((w) => h.includes(w)));

export function ImportResults({ examId, maxScore }: { examId: string; maxScore: number }) {
  const [state, run, parsing] = useActionState(parseResultsFile, null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const data = (state?.ok ? state.data : null) as Parsed | null;
  const [map, setMap] = useState({ phone: -1, name: -1, score: -1, taraz: -1, rank: -1, isPercent: true });
  const [report, setReport] = useState<{ imported: number; unmatched: string[] } | null>(null);

  useEffect(() => {
    if (state?.error) toast.err(state.error);
    if (!data) return;
    const h = data.headers;
    setMap({
      phone: guess(h, ["موبایل", "تلفن", "شماره", "mobile", "phone"]),
      name: guess(h, ["نام", "name"]),
      score: guess(h, ["درصد", "نمره", "score", "percent"]),
      taraz: guess(h, ["تراز", "taraz"]),
      rank: guess(h, ["رتبه", "rank"]),
      isPercent: guess(h, ["درصد", "percent"]) >= 0,
    });
    setReport(null);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => data?.rows.slice(0, 5) ?? [], [data]);
  const Sel = ({ k, label }: { k: "phone" | "name" | "score" | "taraz" | "rank"; label: string }) => (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={map[k]} onChange={(e) => setMap((m) => ({ ...m, [k]: Number(e.target.value) }))}>
        <option value={-1}>— ندارد —</option>
        {data!.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
      </select>
    </label>
  );

  const doImport = () =>
    start(async () => {
      if (map.score < 0) return void toast.err("ستون نمره/درصد را مشخص کنید");
      if (map.phone < 0 && map.name < 0) return void toast.err("ستون موبایل یا نام را مشخص کنید");
      const r = await importResults(examId, map, data!.rows);
      if ("error" in r && r.error) return void toast.err(r.error);
      const rr = r as { imported: number; unmatched: string[] };
      setReport(rr);
      toast.ok(`${rr.imported} نتیجه ثبت شد`);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <form action={run} className="flex flex-wrap items-center gap-2">
        <input type="file" name="file" accept=".xlsx,.csv" className="input !w-auto flex-1 !py-2 text-xs" required />
        <button className="btn-primary btn-sm" disabled={parsing}>{parsing ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} خواندن فایل</button>
      </form>
      <p className="text-xs leading-6 text-white/50">خروجی اکسل کارنامه‌ی آزمون را از پنل دبیر پلکان بگیرید و اینجا بارگذاری کنید. دانش‌آموزان با <b>شماره موبایل</b> (اولویت) یا <b>نام کامل</b> پیدا می‌شوند.</p>

      {data && (
        <div className="space-y-4 rounded-2xl border border-cyan/20 bg-cyan/[.04] p-4">
          <p className="text-sm font-bold">{state?.message} — ستون‌ها را مشخص کنید:</p>
          <div className="grid gap-3 sm:grid-cols-5">
            <Sel k="phone" label="موبایل" />
            <Sel k="name" label="نام" />
            <Sel k="score" label="نمره / درصد *" />
            <Sel k="taraz" label="تراز" />
            <Sel k="rank" label="رتبه" />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={map.isPercent} onChange={() => setMap((m) => ({ ...m, isPercent: true }))} /> ستون نمره «درصد» است</label>
            <label className="flex items-center gap-2"><input type="radio" checked={!map.isPercent} onChange={() => setMap((m) => ({ ...m, isPercent: false }))} /> نمره‌ی خام از {maxScore} است</label>
          </div>
          <div className="table-wrap"><table className="table text-xs"><thead><tr>{data.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{preview.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
          <button onClick={doImport} disabled={pending} className="btn-primary">{pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} ثبت {data.rows.length} نتیجه</button>
        </div>
      )}
      {report && report.unmatched.length > 0 && (
        <div className="rounded-2xl border border-amber/30 bg-amber/10 p-4 text-sm">
          <p className="mb-2 font-bold text-amber">{report.unmatched.length} سطر پیدا نشد (در سایت ثبت‌نام نکرده‌اند یا نام متفاوت است):</p>
          <p className="text-xs leading-6 text-white/70">{report.unmatched.slice(0, 60).join(" · ")}</p>
          <p className="mt-2 text-xs text-white/50">می‌توانید نمره‌ی این افراد را از جدول «ثبت دستی» وارد کنید.</p>
        </div>
      )}
    </div>
  );
}
