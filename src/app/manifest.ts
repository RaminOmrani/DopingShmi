import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "دوپینگ شیمی | استاد جواد پرتویی",
    short_name: "دوپینگ شیمی",
    description: "کلاس‌ها، ویدیوها، آزمون‌ها و کارنامه‌ی شیمی استاد جواد پرتویی",
    lang: "fa",
    dir: "rtl",
    start_url: "/panel?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#03040b",
    theme_color: "#03040b",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "ویدیوها", url: "/panel/videos", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96" }] },
      { name: "آزمون‌ها", url: "/panel/exams", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96" }] },
      { name: "کارنامه من", url: "/panel", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96" }] },
    ],
  };
}
