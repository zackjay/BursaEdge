"""Pembelajaran kendiri: nilai keputusan ranking lepas dan laraskan pemberat faktor.

Setiap hari enjin menyimpan z-skor semua saham (snapshot). Apabila tempoh
hadapan sesuatu horizon berlalu (1 / 5 / 21 hari dagangan), enjin mengira
korelasi pangkat (Information Coefficient, IC) antara setiap faktor dengan
pulangan sebenar. IC dipuratakan secara EMA, dan pemberat faktor dinaikkan
atau diturunkan dalam had yang selamat.
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


def _kedudukan_tarikh(c: pd.Series, tarikh: str) -> Optional[int]:
    ts = pd.Timestamp(tarikh)
    i = int(c.index.searchsorted(ts))
    if i >= len(c):
        return None
    if c.index[i].normalize() != ts.normalize():
        # Tarikh tiada dalam data saham ini (cuti/digantung) — guna hari dagangan sebelumnya
        i -= 1
        if i < 0:
            return None
    return i


def pulangan_hadapan(c: pd.Series, tarikh: str, h: int) -> Optional[Tuple[float, str]]:
    i = _kedudukan_tarikh(c, tarikh)
    if i is None or i + h >= len(c):
        return None
    a, b = float(c.iloc[i]), float(c.iloc[i + h])
    if not (a > 0 and math.isfinite(b)):
        return None
    return b / a - 1.0, c.index[i + h].strftime("%Y-%m-%d")


def _spearman(x: pd.Series, y: pd.Series) -> float:
    d = pd.concat([x, y], axis=1).dropna()
    if len(d) < 15:
        return float("nan")
    a = d.iloc[:, 0].rank()
    b = d.iloc[:, 1].rank()
    if a.std() == 0 or b.std() == 0:
        return float("nan")
    return float(np.corrcoef(a, b)[0, 1])


def kemas_kini_ic(state: dict, cfg: dict, harga: Dict[str, pd.Series]) -> Dict[str, int]:
    """Nilai snapshot yang sudah cukup tempoh hadapannya. Pulangkan bilangan tarikh dinilai per horizon."""
    cfg_p = cfg["pembelajaran"]
    a = float(cfg_p.get("kadar_ema", 0.15))
    dinilai_baru: Dict[str, int] = {}
    for h, cfg_h in cfg["horizon"].items():
        hadapan = int(cfg_h["hari_hadapan"])
        snaps = state.setdefault("snapshot", {}).setdefault(h, {})
        sudah = set(state.setdefault("dinilai_ic", {}).setdefault(h, []))
        ic_ema = state.setdefault("ic_ema", {}).setdefault(h, {})
        bil = 0
        for tarikh in sorted(snaps.keys()):
            if tarikh in sudah:
                continue
            snap = _buka_snapshot(snaps[tarikh])
            pul = {}
            for t in snap:
                if t in harga:
                    r = pulangan_hadapan(harga[t], tarikh, hadapan)
                    if r:
                        pul[t] = r[0]
            if len(pul) < 15:
                continue  # belum cukup hari
            y = pd.Series(pul)
            for f in cfg_h["faktor"]:
                x = pd.Series({t: snap[t].get(f, np.nan) for t in pul})
                ic = _spearman(x, y)
                if math.isfinite(ic):
                    lama = ic_ema.get(f)
                    ic_ema[f] = ic if lama is None else (1 - a) * lama + a * ic
            sudah.add(tarikh)
            snaps.pop(tarikh, None)  # snapshot tidak diperlukan lagi selepas dinilai
            bil += 1
        state["dinilai_ic"][h] = sorted(sudah)[-60:]
        state.setdefault("bilangan_ic", {})[h] = int(state.get("bilangan_ic", {}).get(h, 0)) + bil
        dinilai_baru[h] = bil
    return dinilai_baru


def pemberat_semasa(state: dict, cfg: dict) -> Dict[str, Dict[str, float]]:
    cfg_p = cfg["pembelajaran"]
    skala = float(cfg_p.get("skala_ic", 0.10))
    lo, hi = float(cfg_p.get("had_bawah", 0.4)), float(cfg_p.get("had_atas", 2.0))
    hasil: Dict[str, Dict[str, float]] = {}
    for h, cfg_h in cfg["horizon"].items():
        asas = cfg_h["faktor"]
        ic = state.get("ic_ema", {}).get(h, {})
        mentah = {f: w0 * float(np.clip(1.0 + ic.get(f, 0.0) / skala, lo, hi)) for f, w0 in asas.items()}
        jumlah = sum(mentah.values()) or 1.0
        sasaran = sum(asas.values()) or 1.0
        hasil[h] = {f: round(v / jumlah * sasaran, 4) for f, v in mentah.items()}
    state["pemberat"] = hasil
    return hasil


def _buka_snapshot(snap: dict) -> Dict[str, Dict[str, float]]:
    """Format padat {"f": [faktor], "z": {ticker: [nilai]}} -> {ticker: {faktor: nilai}}."""
    if "f" in snap and "z" in snap:
        f = snap["f"]
        return {t: dict(zip(f, v)) for t, v in snap["z"].items()}
    return snap


def simpan_snapshot(state: dict, cfg: dict, tarikh: str, z_semua: Dict[str, Dict[str, Dict[str, float]]]):
    simpan = int(cfg["pembelajaran"].get("simpan_snapshot_hari", 30))
    for h, z in z_semua.items():
        snaps = state.setdefault("snapshot", {}).setdefault(h, {})
        faktor = list(cfg["horizon"][h]["faktor"].keys())
        snaps[tarikh] = {"f": faktor, "z": {t: [round(float(v.get(k, 0.0)), 2) for k in faktor] for t, v in z.items()}}
        for lama in sorted(snaps.keys())[:-simpan]:
            snaps.pop(lama, None)


def rekod_pilihan(state: dict, tarikh: str, h: str, sisi: str, senarai: List[dict]):
    belum = state.setdefault("pilihan", [])
    # Buang rekod sedia ada untuk tarikh/horizon/sisi yang sama (larian semula)
    belum[:] = [p for p in belum if not (p["tarikh"] == tarikh and p["horizon"] == h and p["sisi"] == sisi)]
    for item in senarai:
        belum.append(
            {
                "tarikh": tarikh,
                "horizon": h,
                "sisi": sisi,
                "ticker": item["ticker"],
                "kod": item["kod"],
                "nama": item["nama"],
                "kedudukan": item["kedudukan"],
                "harga": item["harga"],
            }
        )


def nilai_pilihan(state: dict, cfg: dict, harga: Dict[str, pd.Series]) -> int:
    """Nilai pilihan yang tempoh hadapannya sudah tamat. Pulangkan bilangan dinilai."""
    simpan = int(cfg["pembelajaran"].get("simpan_pilihan_dinilai", 120))
    belum = state.setdefault("pilihan", [])
    dinilai = state.setdefault("pilihan_dinilai", {})
    prestasi = state.setdefault("prestasi", {})
    baki = []
    bil = 0
    purata_cache: Dict[Tuple[str, int], float] = {}
    for p in belum:
        h = p["horizon"]
        hadapan = int(cfg["horizon"].get(h, {}).get("hari_hadapan", 1))
        c = harga.get(p["ticker"])
        r = pulangan_hadapan(c, p["tarikh"], hadapan) if c is not None else None
        if r is None:
            # Simpan jika masih muda; buang jika terlalu lama (data hilang)
            umur = (pd.Timestamp.now(tz="UTC").tz_localize(None) - pd.Timestamp(p["tarikh"])).days
            if umur < 120:
                baki.append(p)
            continue
        pulangan, tarikh_nilai = r
        kunci = (p["tarikh"], hadapan)
        if kunci not in purata_cache:
            semua = [pulangan_hadapan(s, p["tarikh"], hadapan) for s in harga.values()]
            semua = [x[0] for x in semua if x]
            purata_cache[kunci] = float(np.mean(semua)) if semua else 0.0
        arah = 1.0 if p["sisi"] == "bullish" else -1.0
        kena = pulangan * arah > 0
        lebihan = (pulangan - purata_cache[kunci]) * arah
        rekod = dict(p)
        rekod.update(
            {
                "pulangan": round(pulangan * 100.0, 2),
                "lebihan": round(lebihan * 100.0, 2),
                "kena": bool(kena),
                "tarikh_nilai": tarikh_nilai,
            }
        )
        senarai = dinilai.setdefault(h, [])
        senarai.append(rekod)
        dinilai[h] = senarai[-simpan:]
        st = prestasi.setdefault(h, {}).setdefault(p["sisi"], {"n": 0, "kena": 0, "jumlah_pulangan": 0.0, "jumlah_lebihan": 0.0, "n_top3": 0, "kena_top3": 0})
        st["n"] += 1
        st["kena"] += int(kena)
        st["jumlah_pulangan"] += pulangan * arah * 100.0
        st["jumlah_lebihan"] += lebihan * 100.0
        if p["kedudukan"] <= 3:
            st["n_top3"] += 1
            st["kena_top3"] += int(kena)
        bil += 1
    state["pilihan"] = baki
    return bil


def ringkasan_prestasi(state: dict, h: str) -> dict:
    hasil = {}
    for sisi in ("bullish", "bearish"):
        st = state.get("prestasi", {}).get(h, {}).get(sisi)
        if not st or not st.get("n"):
            hasil[sisi] = {"n": 0, "kadar_kena": None, "purata_pulangan": None, "purata_lebihan": None, "kadar_kena_top3": None}
            continue
        n = st["n"]
        hasil[sisi] = {
            "n": n,
            "kadar_kena": round(100.0 * st["kena"] / n, 1),
            "purata_pulangan": round(st["jumlah_pulangan"] / n, 2),
            "purata_lebihan": round(st["jumlah_lebihan"] / n, 2),
            "kadar_kena_top3": round(100.0 * st["kena_top3"] / st["n_top3"], 1) if st.get("n_top3") else None,
        }
    return hasil
