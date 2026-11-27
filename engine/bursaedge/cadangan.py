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

import json
import logging
import math
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

from .faktor import meta_asas
from .penunjuk import bundar_tik

log = logging.getLogger("bursaedge.cadangan")

LABEL = {"harian": "Harian", "mingguan": "Mingguan", "musiman": "Bulanan"}


def _ketepatan_terkini(state: dict, h: str, sisi: str, n: int = 30) -> Optional[float]:
    senarai = [p for p in state.get("pilihan_dinilai", {}).get(h, []) if p.get("sisi") == sisi][-n:]
    if len(senarai) < 15:
        return None
    return 100.0 * sum(1 for p in senarai if p.get("kena")) / len(senarai)


def _rekod_terkini(state: dict, h: str, tindakan: str, n: int = 20) -> Optional[dict]:
    """Prestasi n cadangan terkini (termasuk bayangan) bagi pemutus litar."""
    senarai = [p for p in state.get("cadangan_dinilai", {}).get(h, []) if p.get("tindakan") == tindakan][-n:]
    if not senarai:
        return None
    menang = sum(1 for p in senarai if p.get("r", 0) > 0)
    return {"n": len(senarai), "kadar": 100.0 * menang / len(senarai), "purata_r": sum(p.get("r", 0) for p in senarai) / len(senarai)}


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

    # Pemutus litar: jika cadangan terkini kerap kalah, gantung paparan (tetapi
    # terus rekod sebagai "bayangan" supaya boleh disambung semula secara automatik)
    gantung = {"bullish": False, "bearish": False}
    for sisi, nama in (("bullish", "BELI"), ("bearish", "ELAK")):
        rk = _rekod_terkini(state, h, nama, int(c.get("litar_tetingkap", 20)))
        if rk and rk["n"] >= int(c.get("litar_min", 12)) and rk["kadar"] < float(c.get("litar_kadar", 30)) and rk["purata_r"] < float(c.get("litar_purata_r", -0.25)):
            gantung[sisi] = True
            nota.append(
                f"Cadangan {nama} {LABEL[h]} digantung sementara: {rk['n']} cadangan terkini hanya {rk['kadar']:.0f}% menang "
                f"(purata {rk['purata_r']:+.2f}R). Enjin terus memantau dan akan menyambungnya apabila prestasi pulih."
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
        hasil["bayangan_" + kunci] = hasil[kunci] if gantung[sisi] else []
        if gantung[sisi]:
            hasil[kunci] = []

    pegangan = int(cfg_h.get("pegangan_maks_hari", cfg_h.get("hari_hadapan", 1)))
    return {
        "beli": hasil["beli"],
        "elak": hasil["elak"],
        "digantung": {"beli": gantung["bullish"], "elak": gantung["bearish"]},
        "bayangan_beli": hasil["bayangan_beli"],
        "bayangan_elak": hasil["bayangan_elak"],
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

def rekod(state: dict, tarikh: str, h: str, cad: dict, ujian_balik: bool = False):
    belum = state.setdefault("cadangan_belum", [])
    belum[:] = [p for p in belum if not (p["tarikh"] == tarikh and p["horizon"] == h)]
    bayangan = {id(x) for x in cad.get("bayangan_beli", []) + cad.get("bayangan_elak", [])}
    for item in cad["beli"] + cad["elak"] + cad.get("bayangan_beli", []) + cad.get("bayangan_elak", []):
        belum.append(
            {
                **({"ujian_balik": True} if ujian_balik else {}),
                **({"bayangan": True} if id(item) in bayangan else {}),
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
    if i == 0:
        return None
    bar = df.iloc[i : i + int(p["pegangan"])]
    arah = 1.0 if p["tindakan"] == "BELI" else -1.0
    # Harga sejarah Yahoo dilaraskan semula selepas dividen/pecahan saham. Skala paras
    # yang direkod supaya sepadan dengan siri harga semasa pada tarikh cadangan.
    asal = float(p["harga"])
    rujukan = float(df["Close"].iloc[i - 1])
    faktor = rujukan / asal if asal > 0 and rujukan > 0 else 1.0
    if not (0.05 < faktor < 20):
        faktor = 1.0
    masuk, henti, sasaran = asal * faktor, float(p["henti_rugi"]) * faktor, float(p["sasaran"]) * faktor
    risiko = abs(masuk - henti)
    if risiko <= 0:
        return {"hasil": "batal"}
    for tarikh, b in bar.iterrows():
        o, hi, lo = float(b["Open"]), float(b["High"]), float(b["Low"])
        if arah > 0:
            if lo <= henti:
                return _hasil("henti", min(o, henti), masuk, risiko, arah, tarikh, faktor)
            if hi >= sasaran:
                return _hasil("sasaran", max(o, sasaran), masuk, risiko, arah, tarikh, faktor)
        else:
            if hi >= henti:
                return _hasil("henti", max(o, henti), masuk, risiko, arah, tarikh, faktor)
            if lo <= sasaran:
                return _hasil("sasaran", min(o, sasaran), masuk, risiko, arah, tarikh, faktor)
    if len(bar) < int(p["pegangan"]):
        return None  # belum cukup hari
    return _hasil("tamat", float(bar["Close"].iloc[-1]), masuk, risiko, arah, bar.index[-1], faktor)


def _hasil(jenis: str, keluar: float, masuk: float, risiko: float, arah: float, tarikh, faktor: float = 1.0) -> dict:
    r = max(-5.0, min(10.0, (keluar - masuk) * arah / risiko))
    return {
        "hasil": jenis,
        "keluar": round(keluar / faktor, 3),
        "r": round(r, 2),
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
        bil += 1
        if p.get("bayangan"):
            continue  # bayangan hanya untuk pemutus litar, tidak dikira dalam statistik dipaparkan
        s = stat.setdefault(p["horizon"], {}).setdefault(
            p["tindakan"], {"n": 0, "menang": 0, "sasaran": 0, "henti": 0, "tamat": 0, "jumlah_r": 0.0}
        )
        s["n"] += 1
        s["ujian_balik"] = s.get("ujian_balik", 0) + int(bool(p.get("ujian_balik")))
        s["menang"] += int(r["r"] > 0)
        s[r["hasil"]] += 1
        s["jumlah_r"] = round(s["jumlah_r"] + r["r"], 2)
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
            "ujian_balik": s.get("ujian_balik", 0),
        }
    belum = [p for p in state.get("cadangan_belum", []) if p["horizon"] == h and not p.get("bayangan")]
    hasil["belum_dinilai"] = len(belum)
    isi = state.get("cadangan_isi_semula")
    if isinstance(isi, dict):
        hasil["ujian_balik_dari"] = isi.get("dari")
        hasil["ujian_balik_hingga"] = isi.get("hingga")
    return hasil


# --------------------------------------------------------------------------
# Ujian balik: kira semula cadangan bagi hari-hari lepas daripada ranking yang
# telah direkod dalam data/sejarah/ (sekali sahaja). Hanya data sehingga hari
# itu digunakan untuk penapis aliran, rejim pasaran dan ketepatan terkini.
# --------------------------------------------------------------------------

def _rejim_pada(indeks: Optional[pd.DataFrame], ts: pd.Timestamp) -> str:
    if indeks is None:
        return "tidak diketahui"
    c = indeks["Close"][indeks.index <= ts]
    if len(c) < 200:
        return "tidak diketahui"
    harga, s50, s200 = float(c.iloc[-1]), float(c.tail(50).mean()), float(c.tail(200).mean())
    if harga > s50 > s200:
        return "menaik"
    if harga < s50 < s200:
        return "menurun"
    return "mendatar"


def isi_semula(state: dict, cfg: dict, folder_sejarah: Path, harian: Dict[str, pd.DataFrame], indeks: Optional[pd.DataFrame], tarikh_data: str) -> int:
    if state.get("cadangan_isi_semula") or not folder_sejarah.exists():
        return 0
    sedia = {(p["tarikh"], p["horizon"]) for p in state.get("cadangan_belum", [])}
    for senarai in state.get("cadangan_dinilai", {}).values():
        sedia |= {(p["tarikh"], p["horizon"]) for p in senarai}
    tarikh_diisi, bil = [], 0
    for f in sorted(folder_sejarah.glob("*.json")):
        tarikh = f.stem
        if tarikh >= tarikh_data:
            continue
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        ranking = {
            h: {"bullish": v.get("bullish", []), "bearish": v.get("bearish", [])}
            for h, v in d.get("horizon", {}).items()
            if h in cfg["horizon"]
        }
        if not ranking:
            continue
        ts = pd.Timestamp(tarikh)
        meta = {}
        for t, df in harian.items():
            sub = df[df.index <= ts]
            if len(sub) >= 30 and sub.index[-1] == ts:
                meta[t] = meta_asas(sub)
        rejim = _rejim_pada(indeks, ts)
        # Hanya penilaian yang sudah selesai pada tarikh itu
        state_lepas = {
            "pilihan_dinilai": {
                h: [p for p in state.get("pilihan_dinilai", {}).get(h, []) if p.get("tarikh_nilai", "9999") <= tarikh]
                for h in cfg["horizon"]
            }
        }
        for h in ranking:
            if (tarikh, h) in sedia:
                continue
            cad = jana(h, cfg, ranking, meta, rejim, state_lepas, tarikh)
            rekod(state, tarikh, h, cad, ujian_balik=True)
            bil += len(cad["beli"]) + len(cad["elak"])
        tarikh_diisi.append(tarikh)
    if not tarikh_diisi:
        return 0
    state["cadangan_isi_semula"] = {
        "dari": tarikh_diisi[0] if tarikh_diisi else None,
        "hingga": tarikh_diisi[-1] if tarikh_diisi else None,
        "hari": len(tarikh_diisi),
        "cadangan": bil,
    }
    log.info("Ujian balik cadangan: %d hari, %d cadangan", len(tarikh_diisi), bil)
    return bil
