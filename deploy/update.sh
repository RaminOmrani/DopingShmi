#!/usr/bin/env bash
# به‌روزرسانی به آخرین نسخه‌ی کد و ری‌استارت
set -euo pipefail
cd /opt/doping
export NODE_OPTIONS="--max-old-space-size=1536"
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:push
pnpm build
pm2 reload doping || pm2 start deploy/ecosystem.config.cjs
pm2 save
echo "✔ به‌روز شد"
