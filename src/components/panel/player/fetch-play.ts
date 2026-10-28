/**
 * درخواست /api/videos/[id]/play با مهلت (شامل خواندن بدنه، تا بدنه‌ی نیمه‌کاره پلیر را برای همیشه منتظر نگذارد).
 * بدنه فقط وقتی سرور واقعاً JSON فرستاده خوانده می‌شود (نه صفحه‌ی HTML چالش CDN یا خطای nginx).
 * AbortSignal.timeout در iOS 15 و مرورگرهای قدیمی وجود ندارد.
 */
export async function fetchPlay(input: string, ms: number) {
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(input, { cache: "no-store", signal: ac.signal });
    const type = (r.headers.get("content-type") || "").toLowerCase();
    let body: unknown = null;
    if (type.includes("application/json")) body = await r.json().catch(() => null);
    else void r.body?.cancel().catch(() => {});
    return { ok: r.ok, status: r.status, type, body };
  } finally {
    clearTimeout(tm);
  }
}
