# BursaEdge v3 — Analisa Bursa Malaysia (Android + iOS)

Enjin analisa yang berjalan **sendiri setiap hari bekerja** di GitHub Actions, menyenaraikan
**Top 10 Bullish** dan **Top 10 Bearish** bagi tiga jenis pedagang, belajar daripada ketepatan
ranking lepas, dan menghantar **notifikasi ke telefon** setiap kali ada penemuan baru.

> Analisa teknikal automatik untuk rujukan sahaja. **Bukan nasihat pelaburan.**

```
 GitHub Actions (6:17 ptg MYT, Isnin–Jumaat)
   └─ engine/  → muat turun harga (Yahoo Finance) → 3 horizon → ranking 1–10
                → nilai ketepatan semalam & laraskan pemberat faktor
                → tulis data/latest.json  ─┬─► App BursaEdge (Android/iOS) semak di latar belakang
                                            │      → notifikasi tempatan bila ada penemuan baru
                                            └─► ntfy / Telegram (pilihan, push segera)
```

## Tiga jenis pedagang

| Horizon | Untuk | Pegangan | Faktor (berpemberat, belajar sendiri) | Dinilai selepas | Henti rugi |
|---|---|---|---|---|---|
| **Harian** | Day trader | 1–2 hari | Momentum 3 hari, volum disahkan arah harga, posisi harga tutup, gap pembukaan, tembusan julat 5 hari, lantunan RSI(2) | 1 hari | 1× ATR |
| **Mingguan** | Swing trader | 1–3 minggu | Momentum 10 hari, EMA9/EMA21, cerun MACD, RSI(14), tembusan julat 20 hari, aliran volum | 5 hari | 2× ATR |
| **Musiman** | Seasonal / position | 1–3 bulan | **Corak musim** (prestasi bulan yang sama sehingga 10 tahun lalu), momentum 6 bulan, SMA50/SMA200, kekuatan relatif vs KLCI, jarak dari tinggi 52 minggu | 21 hari | 3× ATR |

Setiap horizon ada penapis kecairan sendiri (contoh: Harian perlukan nilai dagangan ≥ RM1 juta sehari
dan ATR ≥ 1%). Faktor dinormalkan (z-skor) merentas semua saham, digabung, kemudian disusun:
skor tertinggi = Bullish #1, skor terendah = Bearish #1. Setiap saham disertakan alasan,
tahap keyakinan dan paras rujukan (masuk / henti rugi / sasaran).

**Pembelajaran kendiri:** selepas tempoh pegangan berlalu, enjin mengira korelasi pangkat (IC)
setiap faktor dengan pulangan sebenar dan melaraskan pemberat (had 0.4×–2× nilai asal).
Ketepatan setiap ranking direkod dan dipaparkan dalam tab **Prestasi**.

## Tempoh pemantauan → notifikasi

1. Semasa mula guna app, pilih jenis pedagang dan **tempoh pemantauan** (10 / 20 / 40 hari dagangan).
2. Sepanjang tempoh itu enjin berjalan setiap hari, app menyemak di latar belakang dan merekod
   ketepatan — notifikasi ditahan (boleh dihidupkan awal dalam Tetapan).
3. Bila tempoh tamat, app memaklumkan ketepatan dan bertanya: **teruskan notifikasi**,
   pantau 10 hari lagi, atau senyap.
4. Fasa aktif: notifikasi dihantar setiap kali saham **baru masuk Top 10** atau **naik ≥ 2 anak
   tangga**, mengikut horizon, arah (bullish/bearish) dan had kedudukan (Top 3/5/10) yang anda pilih.

## Pasang di Android

1. Buka `https://github.com/<pemilik>/BursaEdge/releases/tag/terkini` di telefon.
2. Muat turun **BursaEdge.apk** → buka → benarkan "Pasang apl tidak diketahui" untuk pelayar anda.
3. Kemas kini seterusnya: muat turun APK baru dan pasang di atas yang lama (data tetap disimpan).
4. Supaya notifikasi tepat masa, matikan *pengoptimuman bateri* untuk BursaEdge.

## Pasang di iPhone

iOS tidak membenarkan pemasangan APK-style. Workflow menghasilkan **BursaEdge-unsigned.ipa**;
tandatangan dengan Apple ID anda sendiri:

- **Sideloadly** (Windows/Mac, percuma): sambung iPhone ke PC → seret IPA → log masuk Apple ID →
  Start. Di iPhone: *Settings → General → VPN & Device Management* → percayai Apple ID anda, dan
  hidupkan *Developer Mode*. Apple ID percuma: app perlu ditandatangan semula setiap **7 hari**
  (Sideloadly boleh auto-refresh melalui Wi-Fi).
- **AltStore / SideStore**: alternatif yang boleh refresh terus dari iPhone.
- **Apple Developer Program (USD99/tahun)**: tandatangan sah 1 tahun atau edar melalui TestFlight.

Pada iPhone, iOS sendiri menentukan bila semakan latar belakang berjalan (boleh lewat beberapa jam).
Untuk **push segera**, aktifkan ntfy (di bawah).

## Notifikasi segera (pilihan): ntfy atau Telegram

Tetapkan di GitHub → repo → *Settings → Secrets and variables → Actions*:

| Secret | Kegunaan |
|---|---|
| `NTFY_TOPIC` | Nama topik rahsia, contoh `bursaedge-zack-8f3k2`. Pasang app **ntfy** (Android/iOS) dan langgan topik yang sama. |
| `NTFY_TOKEN` | (pilihan) jika guna pelayan ntfy sendiri yang berkata laluan |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Hantar ke bot Telegram sedia ada |

Variables (pilihan): `NOTIFIKASI_HORIZON` (contoh `harian,mingguan`), `NOTIFIKASI_SISI`
(`bullish` / `bearish`), `NOTIFIKASI_HAD_KEDUDUKAN` (contoh `5`), `NTFY_SERVER`.

## Repo private?

Repo **public** paling mudah (app baca data terus, minit Actions percuma). Jika **private**:
masukkan *fine-grained token* dalam app (Tetapan → Sumber data) dengan akses repo ini sahaja:
**Contents: Read** dan **Actions: Read & write** (untuk butang "Jalankan analisa sekarang").
Bina iOS menggunakan minit macOS (dikira 10×) pada repo private.

## Tandatangan APK

Secara lalai APK ditandatangan dengan `app/kunci/bursaedge-peribadi.keystore` supaya setiap
versi boleh dipasang sebagai kemas kini. Untuk kunci sendiri, tetapkan secrets
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD` (tukar kunci = perlu buang app lama sekali).

## Konfigurasi enjin

- `engine/universe.json` — senarai saham (kod Bursa). Kod yang gagal dimuat turun disenaraikan
  dalam app (Tetapan, bawah) dan dalam `data/latest.json` → `ticker_gagal`.
- `engine/config.json` — pemberat asas faktor, penapis kecairan, gandaan ATR, tempoh penilaian.
- Jalankan analisa manual: GitHub → *Actions → Analisa Harian → Run workflow*, atau butang
  "Jalankan analisa sekarang" dalam app (perlu token).

Uji enjin di komputer dengan data rawak (tanpa internet):

```bash
cd engine
pip install -r requirements.txt
python -m bursaedge.jalan --sampel --keluar /tmp/ujian-bursaedge
```

## Struktur

```
engine/            Enjin Python (faktor, skor, pembelajaran, notifikasi)
data/              Output harian: latest.json, state.json, sejarah/ (ditulis oleh Actions)
app/               App Expo / React Native (Android + iOS)
.github/workflows/ analisa-harian.yml, bina-android.yml, bina-ios.yml
```

## Had yang perlu diketahui

- Data harga akhir hari daripada Yahoo Finance (bukan suapan rasmi Bursa) — boleh lewat atau
  kadang-kadang tidak lengkap untuk saham kecil.
- Jadual GitHub Actions boleh lewat 5–20 minit; repo public yang tiada aktiviti 60 hari akan
  menghentikan jadual (commit data harian dikira aktiviti).
- Kadar ketepatan sekitar 50% bermaksud tiada kelebihan — pantau tab Prestasi sebelum bergantung
  pada mana-mana horizon.
