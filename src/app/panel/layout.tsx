import { requireUser, isAdmin } from "@/lib/auth";
import { SideNav, BottomNav } from "@/components/panel/PanelNav";
import { Heartbeat } from "@/components/panel/Heartbeat";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh">
      <SideNav admin={isAdmin(user)} />
      <main className="min-w-0 flex-1 px-4 pb-32 pt-5 md:px-8 lg:pb-10">{children}</main>
      <BottomNav />
      <Heartbeat />
    </div>
  );
}
