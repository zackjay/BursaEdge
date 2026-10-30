"""Hantar notifikasi penemuan baru ke Telegram dan/atau ntfy (push ke telefon).

Kedua-duanya pilihan — hanya aktif jika rahsia (secrets) berkaitan ditetapkan
dalam GitHub repo. ntfy disyorkan untuk iPhone kerana penghantaran segera.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.parse
import urllib.request
from typing import Dict, List, Tuple

log = logging.getLogger("bursaedge.notifikasi")

LABEL = {"harian": "Harian", "mingguan": "Mingguan", "musiman": "Musiman"}


def _tapis(penemuan: List[dict]) -> List[dict]:
    horizon = {h.strip() for h in (os.getenv("NOTIFIKASI_HORIZON") or "harian,mingguan,musiman").split(",") if h.strip()}
    sisi = {s.strip() for s in (os.getenv("NOTIFIKASI_SISI") or "bullish,bearish").split(",") if s.strip()}
    try:
        had = int(os.getenv("NOTIFIKASI_HAD_KEDUDUKAN") or 10)
    except ValueError:
        had = 10
    return [p for p in penemuan if p["horizon"] in horizon and p["sisi"] in sisi and p["kedudukan"] <= had]


def susun_mesej(penemuan: List[dict], tarikh: str) -> List[Tuple[str, str]]:
    """Satu mesej bagi setiap horizon yang ada penemuan."""
    kumpulan: Dict[str, List[dict]] = {}
    for p in penemuan:
        kumpulan.setdefault(p["horizon"], []).append(p)
    mesej = []
    for h in ("harian", "mingguan", "musiman"):
        senarai = kumpulan.get(h)
        if not senarai:
            continue
        baris = []
        for sisi, ikon in (("bullish", "🟢"), ("bearish", "🔴")):
            item = sorted([p for p in senarai if p["sisi"] == sisi], key=lambda x: x["kedudukan"])
            if not item:
                continue
            teks = ", ".join(
                f"#{p['kedudukan']} {p['nama']}" + (" (baru)" if p["jenis"] == "baru" else f" (▲{p['dari'] - p['kedudukan']})")
                for p in item
            )
            baris.append(f"{ikon} {sisi.capitalize()}: {teks}")
        tajuk = f"BursaEdge {LABEL[h]} · {len(senarai)} penemuan baru ({tarikh})"
        mesej.append((tajuk, "\n".join(baris)))
    return mesej


def _post(url: str, data: bytes, pengepala: dict) -> bool:
    try:
        req = urllib.request.Request(url, data=data, headers=pengepala, method="POST")
        with urllib.request.urlopen(req, timeout=20) as r:
            return 200 <= r.status < 300
    except Exception as e:  # noqa: BLE001
        log.warning("Notifikasi gagal ke %s: %s", url.split("/bot")[0], e)
        return False


def hantar(penemuan: List[dict], tarikh: str, pautan_app: str = "") -> Dict[str, int]:
    tapis = _tapis(penemuan)
    keputusan = {"telegram": 0, "ntfy": 0, "mesej": 0}
    if not tapis:
        return keputusan
    mesej = susun_mesej(tapis, tarikh)
    keputusan["mesej"] = len(mesej)

    tg_token, tg_chat = os.getenv("TELEGRAM_BOT_TOKEN"), os.getenv("TELEGRAM_CHAT_ID")
    topik = os.getenv("NTFY_TOPIC")
    pelayan = (os.getenv("NTFY_SERVER") or "https://ntfy.sh").rstrip("/")
    ntfy_token = os.getenv("NTFY_TOKEN")

    for tajuk, badan in mesej:
        if tg_token and tg_chat:
            data = urllib.parse.urlencode(
                {"chat_id": tg_chat, "text": f"{tajuk}\n\n{badan}\n\n⚠️ Bukan nasihat pelaburan.", "disable_web_page_preview": "true"}
            ).encode()
            if _post(f"https://api.telegram.org/bot{tg_token}/sendMessage", data, {"Content-Type": "application/x-www-form-urlencoded"}):
                keputusan["telegram"] += 1
        if topik:
            # Format JSON ntfy menyokong tajuk UTF-8 (emoji) dengan selamat
            body = json.dumps({"topic": topik, "title": tajuk, "message": badan, "tags": ["chart_with_upwards_trend"], **({"click": pautan_app} if pautan_app else {})}).encode()
            pengepala = {"Content-Type": "application/json"}
            if ntfy_token:
                pengepala["Authorization"] = f"Bearer {ntfy_token}"
            if _post(pelayan, body, pengepala):
                keputusan["ntfy"] += 1
    return keputusan
