"use client";
import { useEffect } from "react";
import { reloadOnceForChunkError, reportJsError } from "./error-report";

/**
 * خطا در خود layout ریشه: این صفحه جای کل سند را می‌گیرد و CSS سایت ممکن است بارگذاری نشده باشد،
 * پس فقط استایل درون‌خطی و رنگ‌های ثابت حالت تیره.
 */
const btn: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  border: 0,
  borderRadius: 16,
  padding: "12px 20px",
  font: "inherit",
  fontSize: 14,
  fontWeight: 700,
  color: "#fff",
  background: "linear-gradient(110deg, #22d3ee, #8b5cf6 55%, #e879f9)",
  cursor: "pointer",
};

export default function GlobalError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportJsError(error, "global");
    reloadOnceForChunkError(error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl" style={{ colorScheme: "dark", background: "#03040b" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          boxSizing: "border-box",
          background: "#03040b",
          color: "#e7ecff",
          fontFamily: '"Vazirmatn Variable", Vazirmatn, Tahoma, system-ui, sans-serif',
          textAlign: "center",
        }}
      >
        <title>خطا | دوپینگ شیمی</title>
        <main style={{ width: "100%", maxWidth: 360, padding: 32, boxSizing: "border-box", borderRadius: 24, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900 }}>مشکلی پیش آمد</h1>
          <p style={{ margin: "0 0 24px", fontSize: 14, lineHeight: 1.9, color: "rgba(231,236,255,.6)" }}>صفحه با خطا روبه‌رو شد. لطفاً دوباره بارگذاری کنید.</p>
          <button type="button" onClick={() => location.reload()} style={btn}>
            بارگذاری دوباره
          </button>
          {error?.digest && (
            <p style={{ margin: "16px 0 0", fontSize: 11, color: "rgba(231,236,255,.35)" }}>
              کد خطا: <span dir="ltr">{error.digest}</span>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
