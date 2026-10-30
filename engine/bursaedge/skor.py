"""Normalisasi z-skor merentas saham, skor komposit dan ranking bullish/bearish."""
from __future__ import annotations

import math
from typing import Dict, List

import numpy as np
import pandas as pd

from .faktor import teks_alasan
from .penunjuk import bundar_tik


def zskor(jadual: pd.DataFrame) -> pd.DataFrame:
    """Z-skor setiap lajur dengan winsorize (persentil 2–98). NaN -> 0 (neutral)."""
    hasil = pd.DataFrame(index=jadual.index)
    for lajur in jadual.columns:
        s = pd.to_numeric(jadual[lajur], errors="coerce")
        sah = s.dropna()
        if len(sah) < 5 or sah.std(ddof=0) == 0:
            hasil[lajur] = 0.0
            continue
        bawah, atas = sah.quantile(0.02), sah.quantile(0.98)
        s = s.clip(bawah, atas)
        z = (s - s.mean()) / (s.std(ddof=0) or 1.0)
        hasil[lajur] = z.clip(-3.0, 3.0).fillna(0.0)
    return hasil


def skor_horizon(
    horizon: str,
    cfg_h: dict,
    pemberat: Dict[str, float],
    faktor: Dict[str, Dict[str, float]],
    meta: Dict[str, Dict[str, float]],
    maklumat: Dict[str, dict],
    bilangan: int,
):
    """Pulangkan (bullish, bearish, z_semua) untuk satu horizon."""
    nama_faktor = list(cfg_h["faktor"].keys())
    calon = []
    for t, f in faktor.items():
        md = meta.get(t, {})
        if not f:
            continue
        if md.get("nilai_dagangan20", 0) < cfg_h.get("min_nilai_dagangan_rm", 0):
            continue
        if md.get("atr_peratus", 0) < cfg_h.get("min_atr_peratus", 0):
            continue
        sah = sum(1 for k in nama_faktor if math.isfinite(f.get(k, float("nan"))))
        if sah < max(2, len(nama_faktor) // 2):
            continue
        calon.append(t)

    if len(calon) < 5:
        return [], [], {}

    jadual = pd.DataFrame({t: {k: faktor[t].get(k, np.nan) for k in nama_faktor} for t in calon}).T
    z = zskor(jadual)
    w = pd.Series({k: max(0.0, float(pemberat.get(k, 0.0))) for k in nama_faktor})
    jumlah_w = float(w.sum()) or 1.0
    sumbangan = z.mul(w, axis=1) / jumlah_w
    komposit = sumbangan.sum(axis=1)

    def bina(t: str, sisi: str, kedudukan: int) -> dict:
        md = meta[t]
        c = float(komposit[t])
        arah = 1.0 if sisi == "bullish" else -1.0
        # Keyakinan: peratus pemberat faktor yang bersetuju dengan arah
        setuju = sum(float(w[k]) for k in nama_faktor if z.at[t, k] * arah > 0.05)
        keyakinan = round(100.0 * setuju / jumlah_w)
        skor = round(50.0 + 50.0 * math.tanh(c / 0.8), 1)
        susun = sumbangan.loc[t].sort_values(ascending=(sisi == "bearish"))
        alasan = []
        for k, nilai in susun.items():
            if nilai * arah <= 0 or len(alasan) >= 3:
                break
            teks = teks_alasan(k, faktor[t].get(k, float("nan")), md)
            if teks:
                alasan.append(teks)
        harga = md["harga"]
        atr = md.get("atr", float("nan"))
        risiko = cfg_h.get("henti_rugi_atr", 1.0) * atr
        paras = None
        if math.isfinite(atr) and atr > 0:
            henti = harga - arah * risiko
            sasaran = harga + arah * risiko * cfg_h.get("sasaran_r", 1.5)
            paras = {
                "masuk": bundar_tik(harga),
                "henti_rugi": bundar_tik(max(henti, 0.005)),
                "sasaran": bundar_tik(max(sasaran, 0.005)),
            }
        info = maklumat.get(t, {})
        return {
            "kedudukan": kedudukan,
            "ticker": t,
            "kod": info.get("kod", t.replace(".KL", "")),
            "nama": info.get("nama", t),
            "sektor": info.get("sektor", ""),
            "harga": round(harga, 3),
            "ubah_peratus": round(md.get("ubah_peratus", 0.0), 2) if math.isfinite(md.get("ubah_peratus", float("nan"))) else None,
            "skor": skor if sisi == "bullish" else round(100.0 - skor, 1),
            "komposit": round(c, 4),
            "keyakinan": int(keyakinan),
            "atr_peratus": round(md.get("atr_peratus", 0.0), 2),
            "nilai_dagangan_rm": round(md.get("nilai_dagangan20", 0.0)),
            "alasan": alasan,
            "paras": paras,
            "faktor_z": {k: round(float(z.at[t, k]), 2) for k in nama_faktor},
        }

    tertib = komposit.sort_values(ascending=False)
    bullish = [bina(t, "bullish", i + 1) for i, t in enumerate([t for t in tertib.index if tertib[t] > 0][:bilangan])]
    tertib_turun = komposit.sort_values(ascending=True)
    bearish = [bina(t, "bearish", i + 1) for i, t in enumerate([t for t in tertib_turun.index if tertib_turun[t] < 0][:bilangan])]

    z_semua = {t: {k: round(float(z.at[t, k]), 3) for k in nama_faktor} for t in calon}
    return bullish, bearish, z_semua
