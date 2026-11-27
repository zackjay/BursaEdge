#!/usr/bin/env bash
# Pasang APK dalam emulator, lalui skrin utama dan rekod log crash + tangkapan skrin.
set -u
PAKEJ=com.msims.bursaedge
APK=${1:-app/android/app/build/outputs/apk/release/app-release.apk}
mkdir -p ujian-log
: > ujian-log/langkah.txt

hidup() { adb shell pidof "$PAKEJ" >/dev/null 2>&1; }

dump_ui() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml ujian-log/ui.xml >/dev/null 2>&1
}

# Cari elemen ikut teks (padanan tepat dahulu, kemudian sebahagian) dan cetak koordinat tengah
cari_teks() {
  dump_ui
  python3 - "$1" <<'PY'
import re, sys
teks = sys.argv[1]
x = open("ujian-log/ui.xml", encoding="utf-8", errors="ignore").read()
nod = [(m.group(1), tuple(map(int, m.groups()[1:]))) for m in re.finditer(
    r'<node [^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', x)]
pilih = [b for t, b in nod if t == teks] or [b for t, b in nod if teks in t]
if pilih:
    x1, y1, x2, y2 = pilih[0]
    print((x1 + x2) // 2, (y1 + y2) // 2, x1, x2)
PY
}

tekan_teks() {
  local b
  b=$(cari_teks "$1")
  if [ -n "$b" ]; then
    set -- "$1" $b
    echo "Tekan '$1' di $2,$3" | tee -a ujian-log/langkah.txt
    adb shell input tap "$2" "$3"
  else
    echo "Butang '$1' tidak dijumpai" | tee -a ujian-log/langkah.txt
  fi
}

langkah() {
  sleep "$2"
  adb exec-out screencap -p > "ujian-log/$1.png"
  if hidup; then echo "[$1] app masih berjalan" | tee -a ujian-log/langkah.txt; else echo "[$1] APP TIDAK BERJALAN (crash)" | tee -a ujian-log/langkah.txt; fi
}

echo "== Pasang APK"
adb install -r "$APK" 2>&1 | tee ujian-log/pasang.txt
adb logcat -c
echo "== Lancar app"
adb shell monkey -p "$PAKEJ" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
langkah 01-mula 25
tekan_teks "Seterusnya"; langkah 02-tempoh 4
tekan_teks "Seterusnya"; langkah 03-repo 4
tekan_teks "Mula tanpa notifikasi"; langkah 04-cadangan 25

# Cadangan Mingguan
tekan_teks "Mingguan"; langkah 05-cadangan-mingguan 3
tekan_teks "Harian"; sleep 2

# Butiran saham + graf
tekan_teks "Graf ›"; langkah 06-graf-hari 10
# Seret pada graf untuk melihat harga (sentuhan berterusan)
read -r GX GY _ < <(cari_teks "1 Hari") || true
if [ -n "${GY:-}" ]; then
  GY2=$((GY + 300))
  adb shell input motionevent DOWN 300 "$GY2" >/dev/null 2>&1
  adb shell input motionevent MOVE 520 "$GY2" >/dev/null 2>&1
  adb exec-out screencap -p > ujian-log/07-graf-sentuh.png
  adb shell input motionevent UP 520 "$GY2" >/dev/null 2>&1
fi
tekan_teks "1 Minggu"; langkah 08-graf-minggu 3
tekan_teks "1 Bulan"; langkah 09-graf-bulan 3
tekan_teks "1 Tahun"; langkah 10-graf-tahun 3
tekan_teks "Sejak mula"; langkah 11-graf-maks 3
adb shell input swipe 540 1700 540 700 400; langkah 12-butiran-bawah 2
tekan_teks "Pilih untuk dagangan Harian"; langkah 13-dipilih 3
adb shell input keyevent 4; langkah 14-kembali 3
adb shell input swipe 540 1700 540 400 400; adb shell input swipe 540 1700 540 400 400; langkah 15-pilihan-saya 2

tekan_teks "Saham"; langkah 16-saham 4
tekan_teks "Ranking"; langkah 17-ranking 4
tekan_teks "Prestasi ›"; langkah 18-prestasi 4
adb shell input keyevent 4; sleep 2
tekan_teks "Penemuan"; langkah 19-penemuan 3
tekan_teks "Tetapan"; langkah 20-tetapan 3

adb logcat -d > ujian-log/logcat-penuh.txt
grep -E "AndroidRuntime|FATAL|ReactNativeJS|ExceptionsManager|SoLoader|UnsatisfiedLink|Error:|Exception|$PAKEJ" ujian-log/logcat-penuh.txt \
  | grep -v "GoogleApiManager\|Finsky\|chromium" | tail -250 > ujian-log/logcat-ringkas.txt
echo "== LANGKAH ==========================================="
cat ujian-log/langkah.txt
echo "== RALAT JS =========================================="
grep -E "ReactNativeJS.*(Error|Warning|rror)" ujian-log/logcat-penuh.txt | head -40 || true
echo "== TAMAT ============================================="
exit 0
