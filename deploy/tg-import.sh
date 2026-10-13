#!/usr/bin/env bash
# انتقال ویدیوهای تلگرام به آروان در پس‌زمینه (با بستن SSH متوقف نمی‌شود؛ اجرای دوباره از همان‌جا ادامه می‌دهد)
#   bash /opt/doping/deploy/tg-import.sh <chat> [--limit N] [--all]   شروع
#   bash /opt/doping/deploy/tg-import.sh log                           دیدن پیشرفت (خروج: Ctrl+C — انتقال ادامه دارد)
#   bash /opt/doping/deploy/tg-import.sh stop                          توقف
set -euo pipefail
cd /opt/doping
LOG=/var/lib/doping/tg-import.log
PIDF=/var/lib/doping/tg-import.pid
case "${1:-}" in
  "") echo "استفاده: bash deploy/tg-import.sh <chat> | log | stop"; exit 1 ;;
  log) exec tail -n 30 -f "$LOG" ;;
  stop)
    if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; then
      pkill -TERM -P "$(cat "$PIDF")" 2>/dev/null || true; kill -TERM "$(cat "$PIDF")" 2>/dev/null || true
      echo "✔ متوقف شد (اجرای دوباره از همان‌جا ادامه می‌دهد)"
    else echo "انتقالی در حال اجرا نیست"; fi
    rm -f "$PIDF"; exit 0 ;;
esac
if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; then echo "انتقال از قبل در حال اجراست. پیشرفت: bash deploy/tg-import.sh log"; exit 1; fi
# اولویت پایین تا سایت‌های دیگر سرور کند نشوند
nohup nice -n 15 ./node_modules/.bin/tsx scripts/tg.ts import "$@" >> "$LOG" 2>&1 &
echo $! > "$PIDF"
echo "✔ انتقال در پس‌زمینه شروع شد."
echo "   پیشرفت:  bash /opt/doping/deploy/tg-import.sh log    (یا پنل مدیریت ← ویدیوهای آروان)"
