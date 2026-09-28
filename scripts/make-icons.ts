/** ساخت آیکون‌های PWA و تب مرورگر از فایل‌های public/brand */
import sharp from "sharp";

const png = (src: string, size: number, out: string) =>
  sharp(`public/brand/${src}.svg`, { density: 1200 }).resize(size, size).png().toFile(out);

(async () => {
  await png("dp-app-icon", 192, "public/icons/icon-192.png");
  await png("dp-app-icon", 512, "public/icons/icon-512.png");
  await png("dp-maskable", 192, "public/icons/maskable-192.png");
  await png("dp-maskable", 512, "public/icons/maskable-512.png");
  await png("dp-app-icon", 180, "public/icons/apple-touch-icon.png");
  await png("dp-app-icon", 96, "public/icons/shortcut-96.png");
  await png("dp-logo", 64, "public/icons/favicon-64.png");
  console.log("icons ok");
})();
