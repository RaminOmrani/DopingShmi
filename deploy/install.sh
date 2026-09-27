#!/usr/bin/env bash
# نصب کامل «دوپینگ شیمی» روی Ubuntu 22.04 / 24.04 — با کاربر root اجرا شود:
#   bash install.sh                    → سرویس روی http://IP
#   bash install.sh dopingshimi.ir     → با دامنه + گواهی https رایگان (Let's Encrypt)
set -euo pipefail
DOMAIN="${1:-}"
REPO="https://${GITHUB_TOKEN:+${GITHUB_TOKEN}@}github.com/RaminOmrani/DopingShmi.git"
BRANCH="${BRANCH:-claude/dazzling-meitner-g7mbwp}"
DIR="/opt/doping"
DATA="/var/lib/doping"

log() { echo -e "\n\033[1;32m▶ $*\033[0m"; }

log "پیش‌نیازها"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx ufw ca-certificates postgresql postgresql-contrib openssl

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "نصب Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm@10
command -v pm2 >/dev/null 2>&1 || npm install -g pm2

log "دیتابیس PostgreSQL"
systemctl enable --now postgresql
mkdir -p "$DATA/uploads" "$DATA/backups"
if [ ! -f "$DATA/db.pass" ]; then openssl rand -hex 16 > "$DATA/db.pass"; chmod 600 "$DATA/db.pass"; fi
DBPASS="$(cat "$DATA/db.pass")"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='doping'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER doping WITH PASSWORD '$DBPASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='doping'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE doping OWNER doping;"

if [ -d "$DIR/.git" ]; then
  log "به‌روزرسانی کد"
  git -C "$DIR" remote set-url origin "$REPO"
  git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" checkout "$BRANCH" && git -C "$DIR" pull --ff-only origin "$BRANCH"
else
  log "دریافت کد"
  git clone -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

PUBLIC_URL="http://$(curl -s4 --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')"
[ -n "$DOMAIN" ] && PUBLIC_URL="https://$DOMAIN"
if [ ! -f .env ]; then
  log "ساخت فایل .env"
  cat > .env <<ENV
DATABASE_URL="postgresql://doping:${DBPASS}@127.0.0.1:5432/doping"
AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
UPLOAD_DIR="$DATA/uploads"
SITE_URL="$PUBLIC_URL"
ENV
  chmod 600 .env
fi
[ -z "$DOMAIN" ] && ! grep -q INSECURE_COOKIE .env && echo 'INSECURE_COOKIE="1"' >> .env

# سرورهای کم‌حافظه: swap برای build
if [ "$(free -m | awk '/Swap:/{print $2}')" -lt 1024 ] && [ ! -f /swapfile ]; then
  log "ایجاد ۲ گیگابایت swap"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi
export NODE_OPTIONS="--max-old-space-size=1536"

log "نصب وابستگی‌ها، دیتابیس و ساخت"
pnpm install --frozen-lockfile
pnpm db:push
pnpm db:seed
pnpm build

log "راه‌اندازی سرویس با pm2"
pm2 delete doping >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

log "nginx"
SERVER_NAME="${DOMAIN:-_}"
[ -n "$DOMAIN" ] && SERVER_NAME="$DOMAIN www.$DOMAIN"
sed -e "s#__SERVER_NAME__#$SERVER_NAME#" -e "s#__UPLOADS__#$DATA/uploads#" deploy/nginx.conf.template > /etc/nginx/sites-available/doping
ln -sf /etc/nginx/sites-available/doping /etc/nginx/sites-enabled/doping
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

if [ -n "$DOMAIN" ]; then
  log "گواهی SSL"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "⚠️  SSL صادر نشد؛ مطمئن شوید رکورد A دامنه روی IP همین سرور است و دوباره: certbot --nginx -d $DOMAIN"
fi

log "پشتیبان‌گیری خودکار روزانه (ساعت ۴ صبح)"
chmod +x deploy/*.sh
( crontab -l 2>/dev/null | grep -v doping-backup; echo "0 4 * * * $DIR/deploy/backup.sh # doping-backup" ) | crontab -

echo -e "\n\033[1;36m✔ نصب کامل شد: $PUBLIC_URL\033[0m"
echo "ورود مدیر: $PUBLIC_URL/login ← «ورود مدیر با رمز عبور» — شماره 09158148172 و رمز doping1234 (فوراً از تنظیمات تغییر دهید)"
