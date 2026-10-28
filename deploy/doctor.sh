#!/usr/bin/env bash
# عیب‌یابی سریع؛ خروجی را برای پشتیبانی بفرستید (فقط خواندنی؛ چیزی را تغییر نمی‌دهد)
cd /opt/doping 2>/dev/null || { echo "پوشه /opt/doping وجود ندارد"; exit 1; }
echo "=== git (کد روی دیسک)"; git log -1 --oneline
echo "=== build (زمان ساخت .next)"; stat -c '%y' .next/BUILD_ID 2>/dev/null || echo "هنوز build نشده"
echo "=== node/pnpm"; node -v; pnpm -v; free -m | head -2; df -h / | tail -1
echo "=== pm2 (همه سرویس‌ها)"; pm2 status 2>/dev/null
echo "=== pm2 doping (ری‌استارت‌ها و مدت روشن بودن)"; pm2 describe doping 2>/dev/null | grep -Ei "status|restarts|uptime|created at|unstable" | head -8
echo "=== clock"; timedatectl 2>/dev/null | grep -i synchron; date -u
echo "=== ports"; ss -ltnp | grep -E ":(80|443|3[0-9]{3}|4310|5432) "
echo "=== nginx sites"; ls /etc/nginx/sites-enabled
echo "=== postgres"; systemctl is-active postgresql
PORT=$(grep "^PORT=" .env | cut -d= -f2 | tr -d '"'); PORT=${PORT:-3200}; echo "=== app (port $PORT)"; curl -s -m 8 -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:$PORT/"
# بدون ورود: 401 یعنی نسخه‌ی جدید (با گزارش پخش) در حال اجراست؛ 404 یعنی pm2 هنوز build قدیمی را اجرا می‌کند
LIVE=$(curl -s -m 8 -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:$PORT/api/playback-log")
case "$LIVE" in
  401) echo "=== new build live: yes (playback-log → 401)";;
  404) echo "=== new build live: NO (playback-log → 404؛ pm2 reload doping)";;
  *) echo "=== new build live: ? (playback-log → $LIVE)";;
esac
echo "=== nginx"; nginx -t 2>&1 | tail -1; curl -s -m 5 -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1/
echo "=== log (last 40)"; pm2 logs doping --lines 40 --nostream 2>/dev/null | tail -40
