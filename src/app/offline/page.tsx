import { WifiOff } from "lucide-react";

export const metadata = { title: "آفلاین" };

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="card max-w-sm p-8">
        <WifiOff className="mx-auto mb-4 size-12 text-cyan" />
        <h1 className="mb-2 text-xl font-black">اتصال اینترنت برقرار نیست</h1>
        <p className="text-sm text-white/60">به محض اتصال دوباره، صفحه را تازه کنید.</p>
      </div>
    </main>
  );
}
