import { requireUser, isAdmin } from "@/lib/auth";
import { SideNav, BottomNav } from "@/components/panel/PanelNav";
import { Heartbeat } from "@/components/panel/Heartbeat";
import { WatchMarker } from "@/components/panel/WatchMarker";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    // data-panel: در globals.css «کشیدن برای تازه‌سازی» را در پنل غیرفعال می‌کند
    <div data-panel className="flex min-h-dvh">
      <SideNav admin={isAdmin(user)} />
      <main className="min-w-0 flex-1 px-4 pb-32 pt-5 md:px-8 lg:pb-10">{children}</main>
      <BottomNav />
      <Heartbeat />
      <WatchMarker />
    </div>
  );
}
