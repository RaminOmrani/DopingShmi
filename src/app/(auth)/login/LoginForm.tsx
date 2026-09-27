"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Smartphone, KeyRound, ArrowRight, ShieldCheck, Eye, EyeOff, UserPlus, LogIn, MessageSquareText } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { faNum, toEnDigits } from "@/lib/utils";

async function post(url: string, data: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "خطا");
  return d;
}

type Mode = "login" | "signup" | "forgot" | "otp";
const TITLES: Record<Mode, string> = { login: "ورود", signup: "ثبت‌نام", forgot: "بازیابی رمز عبور", otp: "ورود با کد پیامکی" };

export function LoginForm() {
  const params = useSearchParams();
  const nextParam = params.get("next");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [codeSent, setCodeSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
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
    if (!codeSent || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    (navigator.credentials as any).get({ otp: { transport: ["sms"] }, signal: ac.signal }).then((c: any) => c?.code && setCode(c.code)).catch(() => {});
    return () => ac.abort();
  }, [codeSent]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setCodeSent(false);
    setCode("");
    setPassword("");
    setPassword2("");
  };

  const go = (next: string) => {
    location.href = nextParam && next !== "/register" && nextParam.startsWith("/") ? nextParam : next;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.err((err as Error).message);
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const d = await post("/api/auth/otp", { phone });
      setCodeSent(true);
      setTimer(90);
      if (d.devCode) {
        setCode(d.devCode);
        toast.ok(`کد آزمایشی: ${d.devCode}`);
      } else toast.ok("کد تأیید پیامک شد");
      setBusy(false);
      setTimeout(() => codeRef.current?.focus(), 200);
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") return run(async () => go((await post("/api/auth/password", { phone, password })).next));
    if (mode === "signup") {
      if (password !== password2) return toast.err("تکرار رمز عبور یکسان نیست");
      return run(async () => go((await post("/api/auth/register", { phone, password })).next));
    }
    if (!codeSent) return sendCode();
    if (mode === "forgot") {
      if (password !== password2) return toast.err("تکرار رمز عبور یکسان نیست");
      return run(async () => {
        const d = await post("/api/auth/reset", { phone, code, password });
        toast.ok("رمز جدید ثبت شد");
        go(d.next);
      });
    }
    return run(async () => go((await post("/api/auth/verify", { phone, code })).next));
  };

  // ورود با کد: ارسال خودکار پس از ۵ رقم
  useEffect(() => {
    if (mode === "otp" && codeSent && toEnDigits(code).length === 5 && !busy) run(async () => go((await post("/api/auth/verify", { phone, code })).next));
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const pwInput = (value: string, set: (v: string) => void, placeholder: string, auto: string) => (
    <div className="relative">
      <KeyRound className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-white/40" />
      <input className="input !pl-11 !pr-12 text-left" dir="ltr" type={show ? "text" : "password"} autoComplete={auto} placeholder={placeholder} value={value} onChange={(e) => set(e.target.value)} required minLength={mode === "login" ? 1 : 6} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white" aria-label="نمایش رمز">
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );

  return (
    <div className="card glow-border p-7">
      {(mode === "login" || mode === "signup") && (
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1">
          {(["login", "signup"] as const).map((m) => (
            <button key={m} type="button" onClick={() => switchMode(m)} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${mode === m ? "bg-gradient-to-l from-cyan/30 to-violet/40 text-white" : "text-white/50"}`}>
              {m === "login" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />} {TITLES[m]}
            </button>
          ))}
        </div>
      )}
      {(mode === "forgot" || mode === "otp") && (
        <button type="button" onClick={() => switchMode("login")} className="mb-4 flex items-center gap-1 text-xs text-white/50 hover:text-white"><ArrowRight className="size-4" /> بازگشت به ورود</button>
      )}

      <AnimatePresence mode="wait">
        <motion.form key={mode + String(codeSent)} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} onSubmit={submit} className="space-y-4">
          {(mode === "forgot" || mode === "otp") && <h1 className="text-xl font-black">{TITLES[mode]}</h1>}
          {mode === "signup" && <p className="text-sm leading-7 text-white/55">با شماره موبایل و یک رمز دلخواه ثبت‌نام کن؛ بعد اطلاعات پایه و رشته‌ات رو کامل می‌کنی.</p>}
          {mode === "forgot" && !codeSent && <p className="text-sm text-white/55">شماره موبایلت رو بزن تا کد تأیید برات پیامک بشه.</p>}

          {!codeSent ? (
            <div className="relative">
              <Smartphone className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-white/40" />
              <input className="input !pr-12 text-left text-lg tracking-widest" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus required />
            </div>
          ) : (
            <>
              <p className="text-sm text-white/55">کد ۵ رقمی ارسال‌شده به <span dir="ltr" className="font-bold text-white">{faNum(phone)}</span></p>
              <input ref={codeRef} className="input text-center text-3xl font-black tracking-[.6em]" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={5} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d۰-۹]/g, ""))} required />
            </>
          )}

          {mode === "login" && pwInput(password, setPassword, "رمز عبور", "current-password")}
          {mode === "signup" && (
            <>
              {pwInput(password, setPassword, "رمز عبور (حداقل ۶ کاراکتر)", "new-password")}
              {pwInput(password2, setPassword2, "تکرار رمز عبور", "new-password")}
            </>
          )}
          {mode === "forgot" && codeSent && (
            <>
              {pwInput(password, setPassword, "رمز عبور جدید (حداقل ۶ کاراکتر)", "new-password")}
              {pwInput(password2, setPassword2, "تکرار رمز جدید", "new-password")}
            </>
          )}

          <button className="btn-primary w-full !py-4" disabled={busy}>
            {busy ? <Loader2 className="size-5 animate-spin" /> : mode === "login" ? "ورود" : mode === "signup" ? "ثبت‌نام" : !codeSent ? "ارسال کد تأیید" : mode === "forgot" ? <><ShieldCheck className="size-5" /> ثبت رمز جدید و ورود</> : <><ShieldCheck className="size-5" /> ورود</>}
          </button>

          {codeSent && (
            <button type="button" disabled={timer > 0 || busy} onClick={sendCode} className="w-full text-center text-xs text-white/50 hover:text-cyan disabled:opacity-60">
              {timer > 0 ? `ارسال دوباره تا ${faNum(timer)} ثانیه دیگر` : "ارسال دوباره کد"}
            </button>
          )}

          {mode === "login" && (
            <div className="flex items-center justify-between pt-1 text-xs">
              <button type="button" onClick={() => switchMode("forgot")} className="text-cyan hover:underline">رمز را فراموش کرده‌ام</button>
              <button type="button" onClick={() => switchMode("otp")} className="flex items-center gap-1 text-white/45 hover:text-white/80"><MessageSquareText className="size-3.5" /> ورود با کد پیامکی</button>
            </div>
          )}
        </motion.form>
      </AnimatePresence>
    </div>
  );
}
