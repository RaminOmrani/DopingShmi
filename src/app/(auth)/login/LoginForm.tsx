"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Smartphone, KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { faNum, toEnDigits } from "@/lib/utils";

async function post(url: string, data: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "خطا");
  return d;
}

export function LoginForm() {
  const params = useSearchParams();
  const nextParam = params.get("next");
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  // دریافت خودکار کد پیامک (Web OTP) روی اندروید
  useEffect(() => {
    if (step !== "code" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    (navigator.credentials as any)
      .get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((c: any) => c?.code && setCode(c.code))
      .catch(() => {});
    return () => ac.abort();
  }, [step]);

  const go = (next: string) => {
    location.href = nextParam && next !== "/register" && nextParam.startsWith("/") ? nextParam : next;
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const d = await post("/api/auth/otp", { phone });
      setStep("code");
      setTimer(90);
      if (d.devCode) {
        setCode(d.devCode);
        toast.ok(`کد آزمایشی: ${d.devCode}`);
      } else toast.ok("کد تأیید پیامک شد");
      setTimeout(() => codeRef.current?.focus(), 200);
    } catch (err) {
      toast.err((err as Error).message);
    }
    setBusy(false);
  };

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const d = await post("/api/auth/verify", { phone, code });
      go(d.next);
    } catch (err) {
      toast.err((err as Error).message);
      setBusy(false);
    }
  };

  const loginPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await post("/api/auth/password", { phone, password });
      go(d.next);
    } catch (err) {
      toast.err((err as Error).message);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step === "code" && toEnDigits(code).length === 5 && !busy) verify();
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card glow-border p-7">
      <AnimatePresence mode="wait">
        {step === "phone" && (
          <motion.form key="p" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={sendCode}>
            <h1 className="mb-1 text-xl font-black">ورود / ثبت‌نام</h1>
            <p className="mb-6 text-sm text-white/55">شماره موبایلت رو وارد کن تا کد تأیید برات پیامک بشه.</p>
            <label className="label" htmlFor="phone">شماره موبایل</label>
            <div className="relative mb-5">
              <Smartphone className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-white/40" />
              <input id="phone" className="input !pr-12 text-left text-lg tracking-widest" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus required />
            </div>
            <button className="btn-primary w-full !py-4" disabled={busy || phone.length < 10}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : "دریافت کد تأیید"}
            </button>
            <button type="button" onClick={() => setStep("password")} className="mt-5 flex w-full items-center justify-center gap-1 text-xs text-white/40 hover:text-white/70">
              <KeyRound className="size-3.5" /> ورود مدیر با رمز عبور
            </button>
          </motion.form>
        )}
        {step === "code" && (
          <motion.form key="c" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={verify}>
            <button type="button" onClick={() => setStep("phone")} className="mb-4 flex items-center gap-1 text-xs text-white/50 hover:text-white"><ArrowRight className="size-4" /> تغییر شماره</button>
            <h1 className="mb-1 text-xl font-black">کد تأیید</h1>
            <p className="mb-6 text-sm text-white/55">کد ۵ رقمی ارسال‌شده به <span dir="ltr" className="font-bold text-white">{faNum(phone)}</span> را وارد کن.</p>
            <input ref={codeRef} className="input mb-5 text-center text-3xl font-black tracking-[.6em]" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={5} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d۰-۹]/g, ""))} required />
            <button className="btn-primary w-full !py-4" disabled={busy || code.length < 5}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : <><ShieldCheck className="size-5" /> ورود</>}
            </button>
            <button type="button" disabled={timer > 0 || busy} onClick={() => sendCode()} className="mt-4 w-full text-center text-xs text-white/50 hover:text-cyan disabled:opacity-60">
              {timer > 0 ? `ارسال دوباره تا ${faNum(timer)} ثانیه دیگر` : "ارسال دوباره کد"}
            </button>
          </motion.form>
        )}
        {step === "password" && (
          <motion.form key="pw" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={loginPw}>
            <button type="button" onClick={() => setStep("phone")} className="mb-4 flex items-center gap-1 text-xs text-white/50 hover:text-white"><ArrowRight className="size-4" /> ورود با کد پیامکی</button>
            <h1 className="mb-6 text-xl font-black">ورود مدیر</h1>
            <label className="label">شماره موبایل</label>
            <input className="input mb-4 text-left" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <label className="label">رمز عبور</label>
            <input className="input mb-5 text-left" dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="btn-primary w-full !py-4" disabled={busy}>{busy ? <Loader2 className="size-5 animate-spin" /> : "ورود"}</button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
