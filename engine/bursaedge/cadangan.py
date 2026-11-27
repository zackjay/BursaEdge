"""Cadangan dagangan BELI / ELAK bagi setiap horizon (Harian, Mingguan, Bulanan).

Cadangan ialah subset ranking yang lulus syarat tambahan:
  * skor & keyakinan minimum
  * penapis aliran ikut horizon (Harian: tidak kejar saham yang sudah bergerak
    terlalu jauh; Mingguan: harga di sebelah betul EMA21; Bulanan: SMA50)
  * rejim pasaran KLCI dan ketepatan terkini ranking itu sendiri — jika
    ranking bullish sesuatu horizon kerap tersasar, cadangan beli dihadkan
Setiap cadangan disertakan pelan: zon masuk, henti rugi, sasaran, gred A/B/C.
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional

import pandas as pd

from .penunjuk import bundar_tik

LABEL = {"harian": "Harian", "mingguan": "Mingguan", "musiman": "Bulanan"}


def _ketepatan_terkini(state: dict, h: str, sisi: str, n: int = 30) -> Optional[float]:
    senarai = [p for p in state.get("pilihan_dinilai", {}).get(h, []) if p.get("sisi") == sisi][-n:]
    if len(senarai) < 15:
        return None
    return 100.0 * sum(1 for p in senarai if p.get("kena")) / len(senarai)


def _lulus_aliran(h: str, sisi: str, m: dict) -> bool:
    harga = m.get("harga", float("nan"))
    if h == "harian":
        atr = m.get("atr", float("nan"))
        ubah = m.get("ubah_peratus", float("nan"))
        if not (math.isfinite(atr) and atr > 0 and math.isfinite(ubah)):
            return True
        semalam = harga / (1.0 + ubah / 100.0)
        gerak = (harga - semalam) / atr
        # Jangan kejar: pergerakan hari ini melebihi 2.5× ATR ke arah isyarat
        return not (gerak * (1 if sisi == "bullish" else -1) > 2.5)
    rujukan = m.get("ema21") if h == "mingguan" else m.get("sma50")
    if rujukan is None or not math.isfinite(rujukan):
        return True
    return harga > rujukan if sisi == "bullish" else harga < rujukan


def tambah_hari_dagangan(tarikh: str, n: int) -> str:
    return (pd.Timestamp(tarikh) + pd.offsets.BDay(n)).strftime("%Y-%m-%d")


def jana(
    h: str,
    cfg: dict,
    ranking: Dict[str, Dict[str, List[dict]]],
    meta: Dict[str, dict],
    rejim: str,
    state: dict,
    tarikh_data: str,
) -> dict:
    cfg_h = cfg["horizon"][h]
    c = cfg.get("cadangan", {})
    min_skor = float(c.get("min_skor", 65))
    min_yakin = {"bullish": float(c.get("min_keyakinan", 60)), "bearish": float(c.get("min_keyakinan", 60))}
    had = {"bullish": int(c.get("bilangan_beli", 5)), "bearish": int(c.get("bilangan_elak", 5))}
    nota: List[str] = []

    # Rejim pasaran
    if rejim == "menurun":
        if h == "harian":
            nota.append("KLCI dalam aliran menurun — pegang sekejap sahaja dan patuhi henti rugi.")
        else:
            min_yakin["bullish"] += float(c.get("rejim_tambah_keyakinan", 10))
            had["bullish"] = min(had["bullish"], int(c.get("rejim_had", 3)))
            nota.append("KLCI dalam aliran menurun — syarat cadangan BELI diketatkan.")
    elif rejim == "menaik" and h != "harian":
        min_yakin["bearish"] += float(c.get("rejim_tambah_keyakinan", 10))
        had["bearish"] = min(had["bearish"], int(c.get("rejim_had", 3)))
        nota.append("KLCI dalam aliran menaik — syarat cadangan ELAK diketatkan.")

    # Ketepatan terkini ranking ini sendiri (maklum balas kendiri)
    ambang = float(c.get("ambang_ketepatan_lemah", 40))
    for sisi, nama in (("bullish", "BELI"), ("bearish", "ELAK")):
        kadar = _ketepatan_terkini(state, h, sisi)
        if kadar is not None and kadar < ambang:
            min_yakin[sisi] += 10
            had[sisi] = min(had[sisi], 2)
            nota.append(
                f"Ranking {sisi} {LABEL[h]} hanya tepat {kadar:.0f}% dalam 30 penilaian terkini — cadangan {nama} dihadkan."
            )

    lain = [x for x in ranking if x != h]

    def bina(item: dict, sisi: str) -> Optional[dict]:
        t = item["ticker"]
        m = meta.get(t, {})
        harga, atr = m.get("harga"), m.get("atr")
        if not (harga and atr and math.isfinite(harga) and math.isfinite(atr) and atr > 0):
            return None
        arah = 1.0 if sisi == "bullish" else -1.0
        risiko = float(cfg_h.get("henti_rugi_atr", 1.0)) * atr
        henti = harga - arah * risiko
        sasaran = harga + arah * risiko * float(cfg_h.get("sasaran_r", 1.5))
        z0, z1 = cfg_h.get("zon_masuk_atr", [0.3, 0.1])
        zon = sorted([harga - arah * z0 * atr, harga + arah * z1 * atr])
        selari = []
        for x in lain:
            for j, it in enumerate(ranking[x].get(sisi, [])):
                if it["ticker"] == t:
                    selari.append(f"{LABEL[x]} #{j + 1}")
        # Gred: A = isyarat sangat kuat DAN selari dengan horizon lain; B = kuat; C = memadai
        markah = min(100.0, 0.5 * item["skor"] + 0.3 * item["keyakinan"] + 8.0 * min(len(selari), 2))
        gred = "A" if markah >= 84 else "B" if markah >= 72 else "C"
        henti_t = bundar_tik(max(henti, 0.005))
        sasaran_t = bundar_tik(max(sasaran, 0.005))
        return {
            "ticker": t,
            "kod": item["kod"],
            "nama": item["nama"],
            "sektor": item.get("sektor", ""),
            "tindakan": "BELI" if sisi == "bullish" else "ELAK",
            "gred": gred,
            "markah": round(markah, 1),
            "kedudukan": item["kedudukan"],
            "skor": item["skor"],
            "keyakinan": item["keyakinan"],
            "harga": round(harga, 3),
            "ubah_peratus": item.get("ubah_peratus"),
            "zon_masuk": [bundar_tik(max(zon[0], 0.005)), bundar_tik(max(zon[1], 0.005))],
            "henti_rugi": henti_t,
            "sasaran": sasaran_t,
            "risiko_peratus": round(abs(harga - henti_t) / harga * 100.0, 2),
            "ganjaran_peratus": round(abs(sasaran_t - harga) / harga * 100.0, 2),
            "nisbah_rr": round(abs(sasaran_t - harga) / max(abs(harga - henti_t), 1e-9), 2),
            "atr_peratus": item.get("atr_peratus"),
            "alasan": item.get("alasan", [])[:3],
            "selari": selari,
        }

    hasil = {}
    for sisi, kunci in (("bullish", "beli"), ("bearish", "elak")):
        senarai = []
        for item in ranking[h].get(sisi, []):
            if item["skor"] < min_skor or item["keyakinan"] < min_yakin[sisi]:
                continue
            if not _lulus_aliran(h, sisi, meta.get(item["ticker"], {})):
                continue
            r = bina(item, sisi)
            if r:
                senarai.append(r)
        senarai.sort(key=lambda x: -x["markah"])
        hasil[kunci] = senarai[: had[sisi]]

    pegangan = int(cfg_h.get("pegangan_maks_hari", cfg_h.get("hari_hadapan", 1)))
    return {
        "beli": hasil["beli"],
        "elak": hasil["elak"],
        "nota": nota,
        "pegangan_hari": pegangan,
        "sah_hingga": tambah_hari_dagangan(tarikh_data, pegangan),
        "syarat": {
            "min_skor": min_skor,
            "min_keyakinan_beli": min_yakin["bullish"],
            "min_keyakinan_elak": min_yakin["bearish"],
        },
    }


# --------------------------------------------------------------------------
# Rekod & penilaian keputusan cadangan
# --------------------------------------------------------------------------

def rekod(state: dict, tarikh: str, h: str, cad: dict):
    belum = state.setdefault("cadangan_belum", [])
    belum[:] = [p for p in belum if not (p["tarikh"] == tarikh and p["horizon"] == h)]
    for item in cad["beli"] + cad["elak"]:
        belum.append(
            {
                "tarikh": tarikh,
                "horizon": h,
                "tindakan": item["tindakan"],
                "ticker": item["ticker"],
                "kod": item["kod"],
                "nama": item["nama"],
                "gred": item["gred"],
                "harga": item["harga"],
                "henti_rugi": item["henti_rugi"],
                "sasaran": item["sasaran"],
                "pegangan": cad["pegangan_hari"],
            }
        )


def _simulasi(p: dict, df: pd.DataFrame) -> Optional[dict]:
    """Ikut pelan cadangan bar demi bar selepas tarikh cadangan.
    Henti rugi diperiksa dahulu jika kedua-dua paras dicapai pada hari yang sama."""
    ts = pd.Timestamp(p["tarikh"])
    i = int(df.index.searchsorted(ts, side="right"))  # bar pertama selepas tarikh cadangan
    bar = df.iloc[i : i + int(p["pegangan"])]
    arah = 1.0 if p["tindakan"] == "BELI" else -1.0
    masuk, henti, sasaran = float(p["harga"]), float(p["henti_rugi"]), float(p["sasaran"])
    risiko = abs(masuk - henti)
    if risiko <= 0:
        return {"hasil": "batal"}
    for tarikh, b in bar.iterrows():
        o, hi, lo = float(b["Open"]), float(b["High"]), float(b["Low"])
        if arah > 0:
            if lo <= henti:
                return _hasil("henti", min(o, henti), masuk, risiko, arah, tarikh)
            if hi >= sasaran:
                return _hasil("sasaran", max(o, sasaran), masuk, risiko, arah, tarikh)
        else:
            if hi >= henti:
                return _hasil("henti", max(o, henti), masuk, risiko, arah, tarikh)
            if lo <= sasaran:
                return _hasil("sasaran", min(o, sasaran), masuk, risiko, arah, tarikh)
    if len(bar) < int(p["pegangan"]):
        return None  # belum cukup hari
    return _hasil("tamat", float(bar["Close"].iloc[-1]), masuk, risiko, arah, bar.index[-1])


def _hasil(jenis: str, keluar: float, masuk: float, risiko: float, arah: float, tarikh) -> dict:
    return {
        "hasil": jenis,
        "keluar": round(keluar, 3),
        "r": round((keluar - masuk) * arah / risiko, 2),
        "pulangan": round((keluar / masuk - 1.0) * 100.0, 2),
        "tarikh_tutup": pd.Timestamp(tarikh).strftime("%Y-%m-%d"),
    }


def nilai(state: dict, harian: Dict[str, pd.DataFrame], simpan: int = 60) -> int:
    belum = state.setdefault("cadangan_belum", [])
    dinilai = state.setdefault("cadangan_dinilai", {})
    stat = state.setdefault("prestasi_cadangan", {})
    baki, bil = [], 0
    kini = pd.Timestamp.now(tz="UTC").tz_localize(None)
    for p in belum:
        df = harian.get(p["ticker"])
        r = _simulasi(p, df) if df is not None and len(df) else None
        if r is None:
            if (kini - pd.Timestamp(p["tarikh"])).days < 150:
                baki.append(p)
            continue
        if r["hasil"] == "batal":
            continue
        rekod_ = {**p, **r}
        senarai = dinilai.setdefault(p["horizon"], [])
        senarai.append(rekod_)
        dinilai[p["horizon"]] = senarai[-simpan:]
        s = stat.setdefault(p["horizon"], {}).setdefault(
            p["tindakan"], {"n": 0, "menang": 0, "sasaran": 0, "henti": 0, "tamat": 0, "jumlah_r": 0.0}
        )
        s["n"] += 1
        s["menang"] += int(r["r"] > 0)
        s[r["hasil"]] += 1
        s["jumlah_r"] = round(s["jumlah_r"] + r["r"], 2)
        bil += 1
    state["cadangan_belum"] = baki
    return bil


def ringkasan(state: dict, h: str) -> dict:
    hasil = {}
    for tindakan in ("BELI", "ELAK"):
        s = state.get("prestasi_cadangan", {}).get(h, {}).get(tindakan)
        if not s or not s.get("n"):
            hasil[tindakan.lower()] = {"n": 0, "kadar_menang": None, "purata_r": None, "sasaran": 0, "henti": 0, "tamat": 0}
            continue
        hasil[tindakan.lower()] = {
            "n": s["n"],
            "kadar_menang": round(100.0 * s["menang"] / s["n"], 1),
            "purata_r": round(s["jumlah_r"] / s["n"], 2),
            "sasaran": s["sasaran"],
            "henti": s["henti"],
            "tamat": s["tamat"],
        }
    belum = [p for p in state.get("cadangan_belum", []) if p["horizon"] == h]
    hasil["belum_dinilai"] = len(belum)
    return hasil
