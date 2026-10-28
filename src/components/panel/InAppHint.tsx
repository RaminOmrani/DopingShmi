"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Info, X } from "lucide-react";
import { isInAppBrowser } from "@/lib/playback-log";

const KEY = "ds-inapp-hint";

/** کپی با clipboard API و در صورت نبودن اجازه (بعضی WebViewها) با روش قدیمی */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* ادامه با روش قدیمی */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * مرورگر داخلی پیام‌رسان‌ها (تلگرام، ایتا، روبیکا، بله، اینستاگرام) تمام‌صفحه و پخش ویدیو را خراب می‌کند
 * و با کشیدن به پایین بسته می‌شود؛ پیشنهاد باز کردن صفحه در مرورگر اصلی.
 */
export function InAppHint() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  /** اگر کپی نشد، لینک نمایش داده می‌شود تا دستی کپی شود */
  const [manual, setManual] = useState("");

  // تشخیص فقط در مرورگر؛ رندر سرور چیزی نشان نمی‌دهد
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(KEY) === "1";
    } catch {
      /* حالت خصوصی مرورگر */
    }
    setShow(!dismissed && isInAppBrowser());
  }, []);

  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* حالت خصوصی مرورگر */
    }
  };

  const copyLink = async () => {
    const url = location.href;
    if (await copyText(url)) {
      setCopied(true);
      setManual("");
    } else setManual(url);
  };

  return (
    <div className="card mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
      <Info className="size-5 shrink-0 text-amber" />
      <p className="min-w-0 flex-1 text-sm font-bold leading-6">برای پخش بهتر، سایت را در Chrome یا Safari باز کنید</p>
      <button type="button" onClick={copyLink} className="btn-ghost btn-sm shrink-0">
        {copied ? <Check className="size-4 text-lime" /> : <Copy className="size-4" />}
        {copied ? "کپی شد" : "کپی لینک"}
      </button>
      <button type="button" onClick={close} aria-label="بستن" className="grid size-8 shrink-0 place-items-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white">
        <X className="size-4" />
      </button>
      {manual && <input readOnly value={manual} dir="ltr" onFocus={(e) => e.currentTarget.select()} className="input basis-full !py-2 text-xs" aria-label="لینک صفحه" />}
    </div>
  );
}
