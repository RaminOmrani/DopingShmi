import Link from "next/link";
import { MoleculeCanvas } from "@/components/site/MoleculeCanvas";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="fixed inset-0 -z-10 opacity-70"><MoleculeCanvas density={0.6} /></div>
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="size-16 drop-shadow-[0_0_30px_rgba(139,92,246,.6)]" />
          <span className="text-2xl font-black text-gradient">دوپینگ شیمی</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
