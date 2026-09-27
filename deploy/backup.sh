#!/usr/bin/env bash
# پشتیبان روزانه‌ی دیتابیس و عکس‌ها؛ ۱۴ نسخه‌ی آخر نگه داشته می‌شود
set -euo pipefail
DATA=/var/lib/doping
TS=$(date +%Y%m%d-%H%M)
cd "$DATA/backups"
sudo -u postgres pg_dump -Fc doping > "db-$TS.dump"
tar -czf "uploads-$TS.tar.gz" -C "$DATA" uploads
ls -1t db-*.dump | tail -n +15 | xargs -r rm -f
ls -1t uploads-*.tar.gz | tail -n +15 | xargs -r rm -f
