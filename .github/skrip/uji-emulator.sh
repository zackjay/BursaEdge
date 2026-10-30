#!/usr/bin/env bash
# Pasang APK dalam emulator, lalui skrin permulaan dan rekod log crash.
set -u
PAKEJ=com.msims.bursaedge
APK=${1:-app/android/app/build/outputs/apk/release/app-release.apk}
mkdir -p ujian-log

hidup() { adb shell pidof "$PAKEJ" >/dev/null 2>&1; }

tekan_teks() {
  # Cari butang ikut teks melalui uiautomator dan tekan di tengahnya
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml ujian-log/ui.xml >/dev/null 2>&1
  local b
  b=$(python3 - "$1" <<'PY'
import re, sys
teks = sys.argv[1]
x = open("ujian-log/ui.xml", encoding="utf-8", errors="ignore").read()
for m in re.finditer(r'<node [^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', x):
    if teks in m.group(1):
        x1, y1, x2, y2 = map(int, m.groups()[1:])
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
)
  if [ -n "$b" ]; then echo "Tekan '$1' di $b"; adb shell input tap $b; else echo "Butang '$1' tidak dijumpai"; fi
}

langkah() {
  sleep "$2"
  adb exec-out screencap -p > "ujian-log/$1.png"
  if hidup; then echo "[$1] app masih berjalan"; else echo "[$1] APP TIDAK BERJALAN (crash)"; fi
}

echo "== Pasang APK"
adb install -r "$APK" 2>&1 | tee ujian-log/pasang.txt
adb logcat -c
echo "== Lancar app"
adb shell monkey -p "$PAKEJ" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
langkah 01-mula 25
tekan_teks "Seterusnya"; langkah 02-tempoh 4
tekan_teks "Seterusnya"; langkah 03-repo 4
tekan_teks "Mula tanpa notifikasi"; langkah 04-ranking 20
tekan_teks "Prestasi"; langkah 05-prestasi 5
tekan_teks "Tetapan"; langkah 06-tetapan 5

adb logcat -d > ujian-log/logcat-penuh.txt
grep -E "AndroidRuntime|FATAL|ReactNativeJS|ExceptionsManager|SoLoader|UnsatisfiedLink|Error:|Exception|$PAKEJ" ujian-log/logcat-penuh.txt \
  | grep -v "GoogleApiManager\|Finsky\|chromium" | tail -250 > ujian-log/logcat-ringkas.txt
echo "== LOG RINGKAS ======================================"
cat ujian-log/logcat-ringkas.txt
echo "== TAMAT ============================================"
exit 0
