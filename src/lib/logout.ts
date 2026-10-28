/**
 * خروج از حساب (سمت مرورگر). صفحه‌های عمومی سایت در کش سرویس‌ورکر (public/sw.js، کش «-pages»)
 * با هدرِ نام همین کاربر ذخیره شده‌اند؛ پاک می‌شوند تا در حالت آفلاین گوشیِ مشترک نام و لینک مدیریت کاربر قبلی را نشان ندهد.
 */
export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.endsWith("-pages")).map((k) => caches.delete(k)));
  } catch {
    /* مرورگر بدون Cache API */
  }
  location.href = "/";
}
