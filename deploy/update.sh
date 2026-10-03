#!/usr/bin/env bash
# به‌روزرسانی به آخرین نسخه‌ی کد و ری‌استارت
set -euo pipefail

# swap موقت برای build (حدود ۱٫۸ گیگ رم لازم دارد) تا سیستم به‌خاطر کمبود رم سایت‌های دیگر را نبندد
TMP_SWAP=/swapfile-doping-build
add_temp_swap() {
  local avail swapfree
  avail=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
  swapfree=$(awk '/SwapFree/{print int($2/1024)}' /proc/meminfo)
  if [ $((avail + swapfree)) -lt 3500 ] && [ ! -f "$TMP_SWAP" ]; then
    echo "▶ ساخت swap موقت ۳ گیگابایتی برای build (رم آزاد: ${avail}MB، swap آزاد: ${swapfree}MB)"
    fallocate -l 3G "$TMP_SWAP" 2>/dev/null || dd if=/dev/zero of="$TMP_SWAP" bs=1M count=3072 status=none
    chmod 600 "$TMP_SWAP" && mkswap "$TMP_SWAP" >/dev/null && swapon "$TMP_SWAP"
  fi
}
remove_temp_swap() { if [ -f "$TMP_SWAP" ]; then swapoff "$TMP_SWAP" 2>/dev/null || true; rm -f "$TMP_SWAP"; fi; }
trap remove_temp_swap EXIT
cd /opt/doping
export NODE_OPTIONS="--max-old-space-size=1536"
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:push
pnpm db:seed-articles
pnpm db:fixes
add_temp_swap
nice -n 19 pnpm build
remove_temp_swap
pm2 reload doping || pm2 start deploy/ecosystem.config.cjs
pm2 save
echo "✔ به‌روز شد"
