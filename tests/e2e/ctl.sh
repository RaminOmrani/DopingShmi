#!/usr/bin/env bash
# کنترل پروسه‌های محیط تست E2E: هر پروسه در session خودش (setsid) اجرا و با PGID متوقف می‌شود.
# Process control for the E2E harness. Every process runs in its own session (setsid) and is stopped by its
# process-group id, so stopping never touches anything else on the machine (never use `pkill -f`).
#
#   ./ctl.sh up          start HLS mock (:3600), Arvan mock (:3399) and the built app (:3310)
#   ./ctl.sh servers     start only the two mocks
#   ./ctl.sh hls | arvan | app        (re)start one of them
#   ./ctl.sh hls-stop | arvan-stop | app-stop | all-stop
#   ./ctl.sh status
#
# Ports can be changed with E2E_APP_PORT / E2E_HLS_PORT / E2E_ARVAN_PORT (keep them identical for every command).
set -u
# هرگز روی سرور اصلی: دیتابیس production هم روی 127.0.0.1 است و اپ دوم cron/پیامک را تکراری می‌کند
# Never on the production server (its DB is on 127.0.0.1 too; a second app would duplicate the hourly cron/SMS).
case "${1:-}" in
  hls|arvan|app|servers|up)
    for m in /opt/doping /var/lib/doping /etc/nginx/sites-enabled/doping; do
      if [ -e "$m" ]; then echo "refusing: $m exists — this looks like the production server; never run the E2E harness there"; exit 1; fi
    done ;;
esac
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$D/../.." && pwd)"
RUN="$D/.run"
mkdir -p "$RUN"
APP_PORT="${E2E_APP_PORT:-3310}"
HLS_PORT="${E2E_HLS_PORT:-3600}"
ARVAN_PORT="${E2E_ARVAN_PORT:-3399}"
export E2E_APP_PORT="$APP_PORT" E2E_HLS_PORT="$HLS_PORT" E2E_ARVAN_PORT="$ARVAN_PORT"

port_open() { (echo > "/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
alive() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }

# start_bg NAME LOGFILE CMD...  — the new session leader writes its own pid (= PGID) before exec
start_bg() {
  local name=$1 logf=$2; shift 2
  setsid bash -c 'echo $$ > "$0"; exec "$@"' "$RUN/$name.pid" "$@" >>"$logf" 2>&1 < /dev/null &
  for _ in $(seq 1 50); do [ -s "$RUN/$name.pid" ] && return 0; sleep 0.1; done
  echo "could not start $name"; return 1
}
stop_pg() {
  local name=$1
  [ -f "$RUN/$name.pid" ] || return 0
  local pid
  pid=$(cat "$RUN/$name.pid")
  if [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null
    for _ in $(seq 1 30); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
    kill -KILL -- "-$pid" 2>/dev/null
  fi
  rm -f "$RUN/$name.pid"
}
wait_port() { for _ in $(seq 1 150); do port_open "$1" && return 0; sleep 0.2; done; echo "port $1 not up (see $2)"; return 1; }
# refuse to start on a port that something else (not ours) already listens on
port_free_or_ours() {
  local name=$1 port=$2
  if port_open "$port" && ! alive "$name"; then
    echo "port $port is already in use by another process — not starting $name (set E2E_*_PORT to move it)"; return 1
  fi
}

start_hls() {
  stop_pg hls; port_free_or_ours hls "$HLS_PORT" || return 1
  [ -f "$D/vod/master.m3u8" ] || [ -n "${E2E_VOD:-}" ] || { echo "no test video: run $D/gen-vod.sh first"; return 1; }
  start_bg hls "$RUN/hls.out" node "$D/servers.js" hls && wait_port "$HLS_PORT" "$RUN/hls.out" && echo "hls mock up on $HLS_PORT"
}
start_arvan() {
  stop_pg arvan; port_free_or_ours arvan "$ARVAN_PORT" || return 1
  start_bg arvan "$RUN/arvan.out" node "$D/servers.js" arvan && wait_port "$ARVAN_PORT" "$RUN/arvan.out" && echo "arvan mock up on $ARVAN_PORT"
}
start_app() {
  stop_pg app; port_free_or_ours app "$APP_PORT" || return 1
  [ -f "$REPO/.next/BUILD_ID" ] || { echo "app not built: run 'pnpm build' in $REPO first"; return 1; }
  cd "$REPO" || return 1
  # the production build, talking to the Arvan mock instead of napi.arvancloud.ir
  start_bg app "$RUN/app.log" env ARVAN_API_BASE="http://127.0.0.1:$ARVAN_PORT/vod/2.0" PORT="$APP_PORT" pnpm start -p "$APP_PORT" || return 1
  wait_port "$APP_PORT" "$RUN/app.log" || return 1
  for _ in $(seq 1 100); do
    curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/" | grep -qE '200|307|308' && { echo "app up on $APP_PORT"; return 0; }
    sleep 0.2
  done
  echo "app not answering (see $RUN/app.log)"; return 1
}
status() {
  for n in hls arvan app; do
    if alive "$n"; then echo "$n: running (pgid $(cat "$RUN/$n.pid"))"; else echo "$n: stopped"; fi
  done
  for p in "$APP_PORT" "$ARVAN_PORT" "$HLS_PORT"; do port_open "$p" && echo "port $p: open" || echo "port $p: closed"; done
}

case "${1:-}" in
  hls) start_hls ;;
  arvan) start_arvan ;;
  app) start_app ;;
  servers) start_hls && start_arvan ;;
  up) start_hls && start_arvan && start_app ;;
  hls-stop) stop_pg hls ;;
  arvan-stop) stop_pg arvan ;;
  app-stop) stop_pg app ;;
  all-stop) stop_pg app; stop_pg arvan; stop_pg hls; echo "stopped" ;;
  status) status ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
