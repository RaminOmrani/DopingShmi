import { z } from "zod";
import { body, mustUser, ok, route } from "@/lib/api";
import { admitEvents, storePlaybackEvents } from "@/lib/playback-store";

type Ctx = { params: Promise<{ id: string }> };

/**
 * مسیر قدیمی گزارش خطای پلیر؛ برای صفحه‌هایی که هنوز با نسخه‌ی قبلی کد باز مانده‌اند.
 * نسخه‌ی جدید به /api/playback-log می‌فرستد. گزارش با sessionId=legacy در «گزارش پخش ویدیو» ذخیره
 * و در لاگ سرور (pm2 logs doping) هم نوشته می‌شود؛ سهمیه با مسیر جدید مشترک است.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await mustUser();
  const { id } = await params;
  const b = await body(
    req,
    z.object({
      kind: z.string().max(40),
      detail: z.string().max(300).optional(),
      code: z.number().optional(),
      fatal: z.boolean().optional(),
      engine: z.string().max(20).optional(),
      position: z.number().optional(),
      sinceLoadSec: z.number().optional(),
      recovered: z.boolean().optional(),
    }),
  );
  const kind = b.kind.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "legacy";
  const { admitted } = admitEvents(user.id, [{ kind }]);
  if (!admitted.length) return ok(); // کلاینت قدیمی پاسخ را نمی‌خواند
  const ua = (req.headers.get("user-agent") || "").slice(0, 160);
  console.warn(`[video-error] ${JSON.stringify({ user: user.id, video: id, ...b, ua })}`);
  await storePlaybackEvents(
    user.id,
    req,
    [
      {
        kind,
        sessionId: "legacy",
        videoId: id.slice(0, 40),
        engine: b.engine?.slice(0, 10),
        position: b.position,
        sinceLoadSec: b.sinceLoadSec,
        code: b.code,
        fatal: b.fatal,
        detail: b.detail,
        ctx: b.recovered === undefined ? undefined : { recovered: b.recovered },
      },
    ],
    { log: false },
  );
  return ok();
});
