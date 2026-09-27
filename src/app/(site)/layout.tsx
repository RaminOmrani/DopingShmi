import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getUser, isAdmin } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, site] = await Promise.all([getUser(), getSetting("site")]);
  return (
    <>
      <Header user={user ? { name: user.name, admin: isAdmin(user) } : null} />
      {children}
      <Footer site={site} />
    </>
  );
}
