import type { CSSProperties } from "react";

/**
 * نمایش تدریجی هنگام اسکرول، فقط با CSS (کلاس .reveal در globals.css؛ animation-timeline: view()).
 * کامپوننت سرور است و JS ندارد: متن در HTML سرور از همان اول دیده می‌شود (بدون opacity:0 و blur)،
 * پس برای محتوای بالای صفحه (هیرو) هم بی‌خطر است، هرچند آنجا لازم نیست. API قبلی (delay، y) حفظ شده است.
 */
export function Reveal({ children, delay = 0, y = 30, className = "" }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  const style = { "--reveal-delay": String(delay), "--reveal-y": `${y}px` } as CSSProperties;
  return (
    <div className={`reveal ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

const FA = "۰۱۲۳۴۵۶۷۸۹";
const toFa = (s: string) => s.replace(/\d/g, (d) => FA[Number(d)]);

/**
 * شمارنده‌ی آمار: مقدار نهایی همان‌طور که هست در HTML سرور (پیش‌تر از ۰ می‌شمرد و «۰» در HTML و جابه‌جایی پهنا داشت).
 * ارقام لاتین به فارسی تبدیل می‌شوند.
 */
export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  return <span className={className}>{toFa(value)}</span>;
}
