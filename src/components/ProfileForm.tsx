"use client";
import { useState } from "react";
import { Loader2, GraduationCap, Users } from "lucide-react";
import { toast } from "./ui/Toast";
import { GRADES, MAJORS, PROVINCES } from "@/lib/constants";

export interface ProfileInit {
  name: string; grade: string; major: string; province: string; city: string; address: string; school: string;
  parentPhone: string; parentSms: boolean; classStudent: boolean; classGroupId: string; classStatus: string;
}

export function ProfileForm({ initial, groups, mode }: { initial: ProfileInit; groups: { id: string; name: string }[]; mode: "register" | "edit" }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProfileInit>(k: K, v: ProfileInit[K]) => setF((x) => ({ ...x, [k]: v }));
  const approved = initial.classStatus === "APPROVED";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, classStudent: approved ? undefined : f.classStudent, classGroupId: f.classGroupId || null }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast.err(d.error || "خطا");
    toast.ok(mode === "register" ? "ثبت‌نام کامل شد 🎉" : "ذخیره شد");
    if (mode === "register") location.href = "/panel";
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">نام و نام خانوادگی *</label>
        <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">پایه *</label>
          <select className="input" value={f.grade} onChange={(e) => set("grade", e.target.value)} required>
            <option value="">انتخاب</option>
            {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">رشته *</label>
          <select className="input" value={f.major} onChange={(e) => set("major", e.target.value)} required>
            <option value="">انتخاب</option>
            {MAJORS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">استان</label>
          <select className="input" value={f.province} onChange={(e) => set("province", e.target.value)}>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">شهر *</label>
          <input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label">آدرس</label>
        <input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="اختیاری" />
      </div>
      <div>
        <label className="label">مدرسه</label>
        <input className="input" value={f.school} onChange={(e) => set("school", e.target.value)} placeholder="اختیاری" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold"><Users className="size-4 text-cyan" /> اطلاع‌رسانی به والدین (اختیاری)</p>
        <input className="input mb-3 text-left" dir="ltr" inputMode="tel" placeholder="شماره موبایل پدر یا مادر" value={f.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" className="size-4 accent-violet-500" checked={f.parentSms} onChange={(e) => set("parentSms", e.target.checked)} disabled={!f.parentPhone} />
          نتایج آزمون و تغییرات کلاس برای والدین هم پیامک شود
        </label>
      </div>

      <div className={`rounded-2xl border p-4 transition ${f.classStudent ? "border-cyan/40 bg-cyan/[.06]" : "border-white/10 bg-white/[.03]"}`}>
        {approved ? (
          <p className="flex items-center gap-2 text-sm font-bold text-lime"><GraduationCap className="size-5" /> شما شاگرد تأییدشده‌ی کلاس‌های استاد هستید.</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 accent-cyan-400" checked={f.classStudent} onChange={(e) => set("classStudent", e.target.checked)} />
              <span>
                <span className="block text-sm font-bold">من شاگرد کلاس‌های استاد پرتویی هستم</span>
                <span className="text-xs leading-6 text-white/55">بعد از تأیید مدیر، به همه‌ی ویدیوها و آزمون‌های کلاس دسترسی رایگان خواهید داشت.</span>
              </span>
            </label>
            {f.classStudent && groups.length > 0 && (
              <select className="input mt-3" value={f.classGroupId} onChange={(e) => set("classGroupId", e.target.value)}>
                <option value="">کلاس / آموزشگاه خود را انتخاب کنید</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
            {initial.classStatus === "PENDING" && <p className="mt-3 text-xs font-bold text-amber">درخواست شما در انتظار تأیید مدیر است.</p>}
            {initial.classStatus === "REJECTED" && <p className="mt-3 text-xs font-bold text-rose">درخواست قبلی تأیید نشد؛ در صورت نیاز با پشتیبانی تماس بگیرید.</p>}
          </>
        )}
      </div>

      <button className="btn-primary w-full !py-4" disabled={busy}>{busy ? <Loader2 className="size-5 animate-spin" /> : mode === "register" ? "ورود به پنل" : "ذخیره تغییرات"}</button>
    </form>
  );
}
