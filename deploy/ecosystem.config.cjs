// pm2 — سرویس همیشه روشن و ری‌استارت خودکار پس از ریبوت
// پورت از فایل .env (PORT=...) خوانده می‌شود تا با سایت‌های دیگر سرور (مثل ذهن سبز روی 3000) تداخل نداشته باشد
const fs = require("fs");
const path = require("path");
const env = fs.existsSync(path.join(__dirname, "../.env")) ? fs.readFileSync(path.join(__dirname, "../.env"), "utf8") : "";
const PORT = (env.match(/^PORT="?(\d+)"?/m) || [])[1] || "3200";

module.exports = {
  apps: [
    {
      name: "doping",
      cwd: path.join(__dirname, ".."),
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${PORT} -H 127.0.0.1`,
      env: { NODE_ENV: "production", TZ: "Asia/Tehran" },
      max_memory_restart: "700M",
      time: true,
    },
  ],
};
