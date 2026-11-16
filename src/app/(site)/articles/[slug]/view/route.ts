import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";

type Ctx = { params: Promise<{ slug: string }> };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * شمارش بازدید مقاله (POST از کلاینت با sendBeacon). صفحه‌ی مقاله ISR است و رندر سرورش با هر بازدید اجرا نمی‌شود.
 * SQL خام تا updatedAt (lastmod نقشه‌ی سایت و dateModified) با بازدید عوض نشود.
 */
export const POST = route<Ctx>(async (_req, { params }) => {
  const slug = decode((await params).slug).slice(0, 200);
  await db.$executeRaw`UPDATE "Article" SET "views" = "views" + 1 WHERE "slug" = ${slug} AND "published" = true`;
  return ok();
});
