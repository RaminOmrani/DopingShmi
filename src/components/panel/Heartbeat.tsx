"use client";
import { useEffect } from "react";

/** ثبت زمان آنلاین بودن (هر ۶۰ ثانیه وقتی صفحه دیده می‌شود) */
export function Heartbeat() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") fetch("/api/activity/ping", { method: "POST", keepalive: true }).catch(() => {});
    };
    ping();
    const t = setInterval(ping, 60_000);
    return () => clearInterval(t);
  }, []);
  return null;
}
