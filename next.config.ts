import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/** شناسه‌ی کوتاه commit هنگام build؛ در گزارش‌های پخش ویدیو می‌آید تا معلوم شود کدام نسخه روی گوشی دانش‌آموز است */
function buildSha() {
  if (process.env.NEXT_PUBLIC_BUILD_SHA) return process.env.NEXT_PUBLIC_BUILD_SHA;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "dev";
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BUILD_SHA: buildSha() },
  serverExternalPackages: ["sharp", "exceljs", "pg"],
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // فونت‌های خودمیزبان (نام فایل هش ندارد؛ اگر فونت عوض شد، نام فایل را هم عوض کنید)
      {
        source: "/fonts/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
      // تصویر پیش‌نمایش اشتراک‌گذاری (og:image)
      {
        source: "/og.:ext(jpg|png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
