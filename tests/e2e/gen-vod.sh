#!/usr/bin/env bash
# ساخت ویدیوی آزمایشی HLS (۳ کیفیت، ۱۵۰ ثانیه) برای شبیه‌ساز CDN — خروجی در tests/e2e/vod (در git نیست، حدود ۶۶ مگابایت).
# Generates the test HLS stream used by servers.js:
#   vod/master.m3u8, vod/v0|v1|v2/index.m3u8 + seg000.ts … seg037.ts (37 × 4 s + 1 × 2 s = 150 s)
#   v0 = 640x360 (~500k), v1 = 854x480 (~900k), v2 = 1280x720 (~1800k); H.264 Main + AAC 96k stereo 48 kHz;
#   25 fps, keyframe every 2 s, so 4 s segments start on a keyframe.
#   vod/badsegs/v?-seg025-444.ts = seg025 re-encoded as H.264 High 4:4:4 (valid stream, undecodable in browsers)
#   for the mock's corruptMode=444.
# Usage: ./gen-vod.sh [--force]   (needs a full ffmpeg: apt-get install -y ffmpeg)
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$D/vod"
if [ -f "$OUT/master.m3u8" ] && [ -f "$OUT/badsegs/v2-seg025-444.ts" ] && [ "${1:-}" != "--force" ]; then
  echo "vod already exists at $OUT (use --force to regenerate)"; exit 0
fi
command -v ffmpeg > /dev/null || { echo "ffmpeg not found (apt-get install -y ffmpeg)"; exit 1; }
TMP="$D/vod.tmp.$$"
rm -rf "$TMP"; mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
echo "encoding 150 s × 3 levels (takes ~1-3 min)…"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i testsrc2=size=1280x720:rate=25:duration=150 \
  -f lavfi -i sine=frequency=440:sample_rate=48000:duration=150 \
  -filter_complex "[0:v]split=3[v1][v2][v3];[v1]scale=-2:360[v360];[v2]scale=-2:480[v480];[v3]scale=1280:720[v720]" \
  -map "[v360]" -map 1:a -map "[v480]" -map 1:a -map "[v720]" -map 1:a \
  -c:v libx264 -preset veryfast -profile:v main -pix_fmt yuv420p -g 50 -keyint_min 50 -sc_threshold 0 -force_key_frames "expr:gte(t,n_forced*2)" \
  -b:v:0 500k -b:v:1 900k -b:v:2 1800k -c:a aac -b:a 96k -ac 2 \
  -f hls -hls_time 4 -hls_playlist_type vod -hls_flags independent_segments -hls_segment_filename "v%v/seg%03d.ts" \
  -master_pl_name master.m3u8 -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" "v%v/index.m3u8"
mkdir -p badsegs
for lv in v0 v1 v2; do
  ffmpeg -hide_banner -loglevel error -y -copyts -i "$lv/seg025.ts" -c:v libx264 -pix_fmt yuv444p -profile:v high444 -c:a copy -muxdelay 0 -f mpegts "badsegs/$lv-seg025-444.ts"
done
# sanity checks: 38 segments per level, last one 2 s, master lists 3 levels
for lv in v0 v1 v2; do
  n=$(ls "$lv" | grep -c '^seg[0-9]\{3\}\.ts$')
  [ "$n" = 38 ] || { echo "unexpected segment count in $lv: $n (expected 38)"; exit 1; }
  grep -q '^seg037.ts$' "$lv/index.m3u8" || { echo "$lv/index.m3u8 has no seg037.ts"; exit 1; }
done
[ "$(grep -c '^#EXT-X-STREAM-INF' master.m3u8)" = 3 ] || { echo "master.m3u8 does not list 3 levels"; exit 1; }
cd "$D"
rm -rf "$OUT"
mv "$TMP" "$OUT"
trap - EXIT
echo "done: $OUT ($(du -sh "$OUT" | cut -f1))"
cat "$OUT/master.m3u8"
