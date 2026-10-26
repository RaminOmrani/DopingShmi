import { z } from "zod";
import { body, mustUser, ok, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** گزارش خطاهای پخش از پلیر (برای عیب‌یابی در لاگ سرور: pm2 logs doping) — هر کاربر حداکثر ۳۰ گزارش در ساعت */
const quota = new Map<string, { n: number; since: number }>();

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
  const now = Date.now();
  const q = quota.get(user.id);
  if (!q || now - q.since > 3600_000) quota.set(user.id, { n: 1, since: now });
  else if (++q.n > 30) return ok();
  if (quota.size > 5000) quota.clear();
  const ua = (req.headers.get("user-agent") || "").slice(0, 160);
  console.warn(`[video-error] ${JSON.stringify({ user: user.id, video: id, ...b, ua })}`);
  return ok();
});
