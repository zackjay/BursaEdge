#!/usr/bin/env bash
# Pasang APK dalam emulator, lalui skrin utama dan rekod log crash + tangkapan skrin.
set -u
PAKEJ=com.msims.bursaedge
APK=${1:-app/android/app/build/outputs/apk/release/app-release.apk}
mkdir -p ujian-log
: > ujian-log/langkah.txt

read -r W H < <(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr 'x' ' ')
DENS=$(adb shell wm density | grep -oE '[0-9]+' | tail -1)
echo "Skrin ${W}x${H} @ ${DENS}dpi" | tee -a ujian-log/langkah.txt
dp() { echo $(( $1 * DENS / 160 )); }

hidup() { adb shell pidof "$PAKEJ" >/dev/null 2>&1; }
didepan() { adb shell dumpsys activity activities 2>/dev/null | grep -E "mResumedActivity|topResumedActivity" | grep -q "$PAKEJ"; }

dump_ui() {
  adb shell rm -f /sdcard/ui.xml >/dev/null 2>&1
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml ujian-log/ui.xml >/dev/null 2>&1 || : > ujian-log/ui.xml
}

# Cari elemen ikut teks (padanan tepat dahulu, kemudian sebahagian); cetak "x y"
cari_sekali() {
  dump_ui
  python3 - "$1" <<'PY'
import re, sys, html
teks = sys.argv[1]
x = open("ujian-log/ui.xml", encoding="utf-8", errors="ignore").read()
nod = [(html.unescape(m.group(1)), tuple(map(int, m.groups()[1:]))) for m in re.finditer(
    r'<node [^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', x)]
pilih = [b for t, b in nod if t == teks] or [b for t, b in nod if teks in t]
if pilih:
    x1, y1, x2, y2 = pilih[0]
    print((x1 + x2) // 2, (y1 + y2) // 2)
PY
}

tatal_bawah() { adb shell input swipe $((W / 2)) $((H * 3 / 4)) $((W / 2)) $((H / 3)) 350; sleep 1; }
tatal_atas() { adb shell input swipe $((W / 2)) $((H / 3)) $((W / 2)) $((H * 3 / 4)) 350; sleep 1; }

# Cari teks; jika tiada, tatal ke bawah sehingga 4 kali
cari() {
  local b n
  b=$(cari_sekali "$1")
  n=0
  while [ -z "$b" ] && [ "${2:-tatal}" = "tatal" ] && [ $n -lt 4 ]; do
    tatal_bawah
    b=$(cari_sekali "$1")
    n=$((n + 1))
  done
  echo "$b"
}

tekan_teks() {
  local b
  b=$(cari "$1" "${2:-tatal}")
  if [ -n "$b" ]; then
    echo "Tekan '$1' di $b" | tee -a ujian-log/langkah.txt
    # shellcheck disable=SC2086
    adb shell input tap $b
    return 0
  fi
  echo "TIDAK DIJUMPAI: '$1'" | tee -a ujian-log/langkah.txt
  return 1
}

langkah() {
  sleep "$2"
  adb exec-out screencap -p > "ujian-log/$1.png"
  if ! hidup; then
    echo "[$1] APP TIDAK BERJALAN (crash)" | tee -a ujian-log/langkah.txt
  elif ! didepan; then
    echo "[$1] app di latar belakang" | tee -a ujian-log/langkah.txt
  else
    echo "[$1] ok" | tee -a ujian-log/langkah.txt
  fi
}

ke_depan() { didepan || { adb shell monkey -p "$PAKEJ" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 3; }; }

echo "== Pasang APK"
adb install -r "$APK" 2>&1 | tee ujian-log/pasang.txt
adb shell pm grant "$PAKEJ" android.permission.POST_NOTIFICATIONS 2>&1 | tee -a ujian-log/langkah.txt
adb logcat -c
echo "== Lancar app"
adb shell monkey -p "$PAKEJ" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 20
# Dialog "isn't responding" pelancar emulator kadang-kadang menutup skrin — tutup dahulu
for n in 1 2 3; do b=$(cari_sekali "Wait"); [ -n "$b" ] && { adb shell input tap $b; sleep 4; } || break; done
langkah 01-mula 5
tekan_teks "Seterusnya"; langkah 02-tempoh 4
tekan_teks "Seterusnya"; langkah 03-repo 4
tekan_teks "Mula tanpa notifikasi"; langkah 04-cadangan 25
tatal_bawah; langkah 05-cadangan-bawah 2
tatal_atas; tatal_atas
tekan_teks "Mingguan" tiada; langkah 06-cadangan-mingguan 3
tekan_teks "Bulanan" tiada; langkah 07-cadangan-bulanan 3
tekan_teks "Harian" tiada; sleep 2

# Butiran saham + graf
if tekan_teks "Graf ›"; then
  langkah 08-graf-hari 10
  # Sentuh & seret pada graf (sentuhan berterusan) untuk paparan harga titik
  read -r _ CY < <(cari_sekali "1 Hari") || true
  if [ -n "${CY:-}" ]; then
    GY=$((CY + $(dp 140)))
    adb shell input motionevent DOWN $((W / 4)) "$GY" >/dev/null 2>&1
    adb shell input motionevent MOVE $((W / 2)) "$GY" >/dev/null 2>&1
    sleep 1
    adb exec-out screencap -p > ujian-log/09-graf-sentuh.png
    adb shell input motionevent UP $((W / 2)) "$GY" >/dev/null 2>&1
  fi
  tekan_teks "1 Minggu" tiada; langkah 10-graf-minggu 3
  tekan_teks "1 Bulan" tiada; langkah 11-graf-bulan 3
  tekan_teks "1 Tahun" tiada; langkah 12-graf-tahun 3
  tekan_teks "Sejak mula" tiada; langkah 13-graf-maks 3
  tatal_bawah; langkah 14-butiran-bawah 2
  tekan_teks "Pilih untuk dagangan Harian"; langkah 15-dipilih 3
  tatal_bawah; tatal_bawah; langkah 16-butiran-akhir 2
  adb shell input keyevent 4; sleep 2
fi
ke_depan
tekan_teks "Pilihan saya · Harian"; tatal_bawah; langkah 17-pilihan-saya 2
tatal_bawah; tatal_bawah; langkah 18-rekod-cadangan 2

tekan_teks "Saham" tiada; langkah 19-saham 4
tekan_teks "% hari ini" tiada; langkah 20-saham-susun 3
tekan_teks "Ranking" tiada; langkah 21-ranking 4
tekan_teks "Prestasi ›" tiada; langkah 22-prestasi 4
adb shell input keyevent 4; sleep 2; ke_depan
tekan_teks "Penemuan" tiada; langkah 23-penemuan 3
tekan_teks "Tetapan" tiada; langkah 24-tetapan 3
# Peringatan: kad tetapan, jadual sebenar (dumpsys alarm) dan penghantaran peringatan ujian
tekan_teks "Ingatkan masa beli & jual"; langkah 25-peringatan 2
tekan_teks "Uji peringatan (tiba dalam 1 minit)" && { sleep 2; adb exec-out screencap -p > ujian-log/26-uji-dijadual.png; tekan_teks "OK" tiada; }
adb shell dumpsys alarm | grep -B2 -A12 "$PAKEJ" | head -120 > ujian-log/alarm.txt 2>&1
adb shell dumpsys notification --noredact 2>/dev/null | grep -A3 "NotificationChannel{mId='peringatan'" | head -8 >> ujian-log/alarm.txt
tekan_teks "Modal bagi setiap dagangan"; langkah 27-kos 2
adb shell input keyevent 3; sleep 75
adb shell cmd statusbar expand-notifications; sleep 3
adb exec-out screencap -p > ujian-log/28-notifikasi-ujian.png
adb shell dumpsys notification --noredact 2>/dev/null | grep -E "android.title|android.text|android.bigText" | head -12 > ujian-log/notifikasi.txt
adb shell cmd statusbar collapse; ke_depan

adb logcat -d > ujian-log/logcat-penuh.txt
grep -E "AndroidRuntime|FATAL|ReactNativeJS|ExceptionsManager|SoLoader|UnsatisfiedLink|Error:|Exception|$PAKEJ" ujian-log/logcat-penuh.txt \
  | grep -v "GoogleApiManager\|Finsky\|chromium" | tail -250 > ujian-log/logcat-ringkas.txt
echo "== LANGKAH ==========================================="
cat ujian-log/langkah.txt
echo "== RALAT JS =========================================="
grep -E "ReactNativeJS.*(Error|Warning|rror)" ujian-log/logcat-penuh.txt | head -40 || true
echo "== TAMAT ============================================="
exit 0
