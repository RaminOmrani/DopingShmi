"use client";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/Toast";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [busy, setBusy] = useState(false);
  const [has, setHas] = useState(hasPassword);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (fd.get("password") !== fd.get("password2")) return toast.err("تکرار رمز یکسان نیست");
    setBusy(true);
    const r = await fetch("/api/me/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: fd.get("current") ?? "", password: fd.get("password") }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast.err(d.error || "خطا");
    toast.ok(has ? "رمز عبور تغییر کرد" : "رمز عبور ثبت شد");
    setHas(true);
    form.reset();
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="flex items-center gap-2 font-black"><KeyRound className="size-4 text-cyan" /> {has ? "تغییر رمز عبور" : "تعیین رمز عبور"}</p>
      {!has && <p className="text-xs leading-6 text-white/50">با تعیین رمز، دفعه‌ی بعد بدون پیامک و با شماره + رمز وارد می‌شوی.</p>}
      {has && <input name="current" type="password" className="input" dir="ltr" placeholder="رمز فعلی" autoComplete="current-password" required />}
      <input name="password" type="password" className="input" dir="ltr" placeholder="رمز جدید (حداقل ۶ کاراکتر)" autoComplete="new-password" minLength={6} required />
      <input name="password2" type="password" className="input" dir="ltr" placeholder="تکرار رمز جدید" autoComplete="new-password" minLength={6} required />
      <button disabled={busy} className="btn-ghost w-full">{busy ? <Loader2 className="size-4 animate-spin" /> : "ذخیره رمز"}</button>
    </form>
  );
}
