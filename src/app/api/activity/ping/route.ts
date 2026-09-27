import { mustUser, ok, route } from "@/lib/api";
import { heartbeat } from "@/lib/points";

export const POST = route(async () => {
  const u = await mustUser();
  await heartbeat(u.id, u.lastSeenAt);
  return ok();
});
