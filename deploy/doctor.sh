#!/usr/bin/env bash
# عیب‌یابی سریع؛ خروجی را برای پشتیبانی بفرستید
cd /opt/doping 2>/dev/null || { echo "پوشه /opt/doping وجود ندارد"; exit 1; }
echo "=== git"; git log --oneline -1
echo "=== node/pnpm"; node -v; pnpm -v; free -m | head -2; df -h / | tail -1
echo "=== pm2 (همه سرویس‌ها)"; pm2 status 2>/dev/null
echo "=== ports"; ss -ltnp | grep -E ":(80|443|3[0-9]{3}|4310|5432) "
echo "=== nginx sites"; ls /etc/nginx/sites-enabled
echo "=== postgres"; systemctl is-active postgresql
PORT=$(grep "^PORT=" .env | cut -d= -f2 | tr -d '"'); echo "=== app (port $PORT)"; curl -s -m 8 -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:$PORT/"
echo "=== nginx"; nginx -t 2>&1 | tail -1; curl -s -m 5 -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1/
echo "=== log (last 40)"; pm2 logs doping --lines 40 --nostream 2>/dev/null | tail -40
