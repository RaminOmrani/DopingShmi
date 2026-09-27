// pm2 — سرویس همیشه روشن و ری‌استارت خودکار پس از ریبوت
module.exports = {
  apps: [
    {
      name: "doping",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      env: { NODE_ENV: "production", TZ: "Asia/Tehran" },
      max_memory_restart: "700M",
      time: true,
    },
  ],
};
