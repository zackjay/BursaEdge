"""Faktor mentah bagi setiap horizon dagangan.

Setiap faktor berorientasikan arah: nilai lebih tinggi = lebih bullish,
nilai lebih rendah = lebih bearish. Faktor tidak berarah (kecairan, ATR)
digunakan sebagai penapis, bukan dalam skor.
"""
from __future__ import annotations

import math
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd

from . import penunjuk as p

LABEL_FAKTOR = {
    # Harian
    "mom3": "Momentum 3 hari",
    "vol_sah": "Volum disahkan",
    "posisi_tutup": "Posisi harga tutup",
    "gap": "Gap pembukaan",
    "tembus5": "Tembusan julat 5 hari",
    "rsi2_pantul": "Lantunan RSI(2)",
    # Mingguan
    "mom10": "Momentum 10 hari",
    "trend_ema": "Aliran EMA9/EMA21",
    "macd_cerun": "Cerun MACD",
    "rsi14": "RSI(14)",
    "tembus20": "Tembusan julat 20 hari",
    "vol_trend": "Aliran volum",
    # Musiman
    "musim": "Corak musim (sejarah)",
    "mom6b": "Momentum 6 bulan",
    "trend200": "Aliran SMA50/SMA200",
    "rs_klci": "Kekuatan relatif vs KLCI",
    "jarak52": "Jarak dari tinggi 52 minggu",
}


def _selamat(x) -> float:
    try:
        x = float(x)
    except (TypeError, ValueError):
        return float("nan")
    return x if math.isfinite(x) else float("nan")


def _posisi_julat(tutup: float, tinggi: float, rendah: float) -> float:
    if not (math.isfinite(tinggi) and math.isfinite(rendah)) or tinggi <= rendah:
        return 0.0
    tengah = (tinggi + rendah) / 2.0
    separuh = (tinggi - rendah) / 2.0
    return float(np.clip((tutup - tengah) / separuh, -2.0, 2.0))


def meta_asas(df: pd.DataFrame) -> Dict[str, float]:
    tutup = df["Close"]
    atr14 = p.atr(df, 14)
    harga = _selamat(tutup.iloc[-1])
    semalam = _selamat(tutup.iloc[-2]) if len(tutup) > 1 else float("nan")
    nilai = (df["Close"] * df["Volume"]).tail(20).mean()
    return {
        "harga": harga,
        "ubah_peratus": (harga / semalam - 1.0) * 100.0 if semalam and math.isfinite(semalam) else float("nan"),
        "atr": _selamat(atr14.iloc[-1]),
        "atr_peratus": _selamat(atr14.iloc[-1] / harga * 100.0) if harga else float("nan"),
        "nilai_dagangan20": _selamat(nilai),
        "tinggi52": _selamat(df["High"].tail(252).max()),
        "rendah52": _selamat(df["Low"].tail(252).min()),
        "volum": _selamat(df["Volume"].iloc[-1]),
    }


def faktor_harian(df: pd.DataFrame) -> Tuple[Dict[str, float], Dict[str, float]]:
    f: Dict[str, float] = {}
    m: Dict[str, float] = {}
    if len(df) < 30:
        return f, m
    c, o, h, l, v = df["Close"], df["Open"], df["High"], df["Low"], df["Volume"]
    tutup = float(c.iloc[-1])
    semalam = float(c.iloc[-2])
    ret1 = tutup / semalam - 1.0

    f["mom3"] = _selamat(tutup / c.iloc[-4] - 1.0)

    purata_vol = v.iloc[-21:-1].mean()
    if purata_vol and purata_vol > 0 and v.iloc[-1] > 0:
        nisbah = float(v.iloc[-1] / purata_vol)
        m["nisbah_vol"] = nisbah
        f["vol_sah"] = float(np.clip(math.log(nisbah), -2.0, 2.0)) * (1.0 if ret1 >= 0 else -1.0)
    else:
        f["vol_sah"] = float("nan")
    m["ret1"] = ret1

    hi, lo = float(h.iloc[-1]), float(l.iloc[-1])
    f["posisi_tutup"] = (2.0 * (tutup - lo) / (hi - lo) - 1.0) if hi > lo else 0.0
    f["gap"] = _selamat(o.iloc[-1] / semalam - 1.0)
    f["tembus5"] = _posisi_julat(tutup, float(h.iloc[-6:-1].max()), float(l.iloc[-6:-1].min()))

    r2 = p.rsi(c, 2).iloc[-1]
    m["rsi2"] = _selamat(r2)
    f["rsi2_pantul"] = _selamat((50.0 - r2) / 50.0)
    return f, m


def faktor_mingguan(df: pd.DataFrame) -> Tuple[Dict[str, float], Dict[str, float]]:
    f: Dict[str, float] = {}
    m: Dict[str, float] = {}
    if len(df) < 60:
        return f, m
    c, h, l, v = df["Close"], df["High"], df["Low"], df["Volume"]
    tutup = float(c.iloc[-1])

    f["mom10"] = _selamat(tutup / c.iloc[-11] - 1.0)
    e9, e21 = p.ema(c, 9).iloc[-1], p.ema(c, 21).iloc[-1]
    f["trend_ema"] = _selamat((e9 - e21) / e21)
    hist = p.macd_hist(c)
    f["macd_cerun"] = _selamat((hist.iloc[-1] - hist.iloc[-4]) / tutup)
    r14 = p.rsi(c, 14).iloc[-1]
    m["rsi14"] = _selamat(r14)
    f["rsi14"] = _selamat((r14 - 50.0) / 50.0)
    f["tembus20"] = _posisi_julat(tutup, float(h.iloc[-21:-1].max()), float(l.iloc[-21:-1].min()))

    v5, v20 = v.tail(5).mean(), v.tail(20).mean()
    mom5 = tutup / c.iloc[-6] - 1.0
    if v20 and v20 > 0 and v5 > 0:
        nisbah = float(v5 / v20)
        m["nisbah_vol5"] = nisbah
        f["vol_trend"] = float(np.clip(math.log(nisbah), -1.5, 1.5)) * (1.0 if mom5 >= 0 else -1.0)
    else:
        f["vol_trend"] = float("nan")
    return f, m


def corak_musim(c: pd.Series, tetingkap: int = 21, min_tahun: int = 3, maks_tahun: int = 10) -> Optional[Dict[str, float]]:
    """Pulangan sejarah bagi tetingkap `tetingkap` hari dagangan yang bermula
    pada tarikh kalendar yang sama pada tahun-tahun lepas."""
    if len(c) < 260:
        return None
    indeks = c.index
    akhir = indeks[-1]
    pulangan = []
    for y in range(1, maks_tahun + 1):
        sauh = akhir - pd.DateOffset(years=y)
        if sauh < indeks[0]:
            break
        i = int(indeks.searchsorted(sauh))
        j = i + tetingkap
        if j >= len(c) or i >= len(c):
            continue
        a, b = float(c.iloc[i]), float(c.iloc[j])
        if a > 0 and math.isfinite(a) and math.isfinite(b):
            pulangan.append(b / a - 1.0)
    n = len(pulangan)
    if n < min_tahun:
        return None
    arr = np.clip(np.array(pulangan), -0.5, 0.5)
    purata = float(arr.mean())
    sisihan = float(arr.std(ddof=1)) if n > 1 else 0.0
    if sisihan > 1e-9:
        t = purata / (sisihan / math.sqrt(n))
    else:
        t = 4.0 * np.sign(purata)
    return {
        "skor": float(np.clip(t, -4.0, 4.0)),
        "purata": purata,
        "tahun": n,
        "naik": int((arr > 0).sum()),
    }


def faktor_musiman(df: pd.DataFrame, indeks: Optional[pd.Series], cfg_musim: dict) -> Tuple[Dict[str, float], Dict[str, float]]:
    f: Dict[str, float] = {}
    m: Dict[str, float] = {}
    if len(df) < 210:
        return f, m
    c, h = df["Close"], df["High"]
    tutup = float(c.iloc[-1])

    musim = corak_musim(
        c,
        tetingkap=int(cfg_musim.get("tetingkap_hari", 21)),
        min_tahun=int(cfg_musim.get("min_tahun", 3)),
        maks_tahun=int(cfg_musim.get("maks_tahun", 10)),
    )
    if musim:
        f["musim"] = musim["skor"]
        m["musim_purata"] = musim["purata"]
        m["musim_tahun"] = musim["tahun"]
        m["musim_naik"] = musim["naik"]
    else:
        f["musim"] = float("nan")

    if len(c) >= 127:
        f["mom6b"] = _selamat(c.iloc[-22] / c.iloc[-127] - 1.0)
    s50, s200 = p.sma(c, 50).iloc[-1], p.sma(c, 200).iloc[-1]
    if math.isfinite(s200) and s200 > 0:
        f["trend200"] = _selamat(0.5 * (s50 / s200 - 1.0) + 0.5 * (tutup / s200 - 1.0))
        m["sma50_atas"] = 1.0 if s50 > s200 else 0.0
    if indeks is not None and len(c) >= 64:
        ki = indeks.reindex(c.index).ffill()
        if math.isfinite(ki.iloc[-1]) and math.isfinite(ki.iloc[-64]) and ki.iloc[-64] > 0:
            f["rs_klci"] = _selamat((tutup / c.iloc[-64] - 1.0) - (ki.iloc[-1] / ki.iloc[-64] - 1.0))
    t52 = float(h.tail(252).max())
    if t52 > 0:
        f["jarak52"] = _selamat(tutup / t52 - 1.0)
    return f, m


def kira_faktor(horizon: str, df: pd.DataFrame, indeks: Optional[pd.Series], cfg: dict):
    if horizon == "harian":
        return faktor_harian(df)
    if horizon == "mingguan":
        return faktor_mingguan(df)
    if horizon == "musiman":
        return faktor_musiman(df, indeks, cfg.get("musim", {}))
    raise ValueError(f"Horizon tidak dikenali: {horizon}")


def teks_alasan(nama: str, nilai: float, m: Dict[str, float]) -> Optional[str]:
    """Hasilkan penerangan ringkas (Bahasa Melayu) bagi satu faktor."""
    if nilai is None or not math.isfinite(nilai):
        return None
    pct = nilai * 100.0
    if nama == "mom3":
        return f"Momentum 3 hari {pct:+.1f}%"
    if nama == "vol_sah":
        r = m.get("nisbah_vol", math.exp(abs(nilai)))
        arah = "naik" if m.get("ret1", 0) >= 0 else "turun"
        if r >= 1.2:
            return f"Volum {r:.1f}x purata 20 hari, harga {arah}"
        return f"Volum rendah ({r:.1f}x purata) semasa harga {arah}"
    if nama == "posisi_tutup":
        if nilai > 0.5:
            return "Tutup hampir paras tertinggi hari"
        if nilai < -0.5:
            return "Tutup hampir paras terendah hari"
        return "Tutup di tengah julat hari"
    if nama == "gap":
        return f"Gap {'naik' if nilai >= 0 else 'turun'} {pct:+.1f}% semasa dibuka"
    if nama == "tembus5":
        if nilai > 1:
            return "Tembus paras tertinggi 5 hari"
        if nilai < -1:
            return "Pecah paras terendah 5 hari"
        return f"Di separuh {'atas' if nilai > 0 else 'bawah'} julat 5 hari"
    if nama == "rsi2_pantul":
        r2 = m.get("rsi2", 50 - nilai * 50)
        if r2 < 10:
            return f"RSI(2) {r2:.0f} — terlebih jual, potensi lantunan"
        if r2 > 90:
            return f"RSI(2) {r2:.0f} — terlebih beli, potensi undur"
        return f"RSI(2) {r2:.0f}"
    if nama == "mom10":
        return f"Momentum 10 hari {pct:+.1f}%"
    if nama == "trend_ema":
        return f"EMA9 {'atas' if nilai >= 0 else 'bawah'} EMA21 ({pct:+.1f}%)"
    if nama == "macd_cerun":
        return f"Histogram MACD {'menaik' if nilai >= 0 else 'menurun'}"
    if nama == "rsi14":
        r = m.get("rsi14", 50 + nilai * 50)
        if r > 70:
            return f"RSI(14) {r:.0f} — momentum kuat (terlebih beli)"
        if r < 30:
            return f"RSI(14) {r:.0f} — lemah (terlebih jual)"
        return f"RSI(14) {r:.0f}"
    if nama == "tembus20":
        if nilai > 1:
            return "Tembus paras tertinggi 20 hari"
        if nilai < -1:
            return "Pecah paras terendah 20 hari"
        return f"Di separuh {'atas' if nilai > 0 else 'bawah'} julat 20 hari"
    if nama == "vol_trend":
        r = m.get("nisbah_vol5", math.exp(abs(nilai)))
        return f"Volum 5 hari {r:.1f}x purata 20 hari"
    if nama == "musim":
        n = int(m.get("musim_tahun", 0))
        k = int(m.get("musim_naik", 0))
        avg = m.get("musim_purata", 0.0) * 100.0
        if n:
            return f"Corak musim: naik {k}/{n} tahun bagi sebulan akan datang (purata {avg:+.1f}%)"
        return None
    if nama == "mom6b":
        return f"Momentum 6 bulan {pct:+.1f}%"
    if nama == "trend200":
        if m.get("sma50_atas", 0) >= 1:
            return "SMA50 atas SMA200 — aliran jangka panjang menaik"
        return "SMA50 bawah SMA200 — aliran jangka panjang menurun"
    if nama == "rs_klci":
        return f"{'Mengatasi' if nilai >= 0 else 'Ketinggalan'} KLCI {pct:+.1f}% (3 bulan)"
    if nama == "jarak52":
        if nilai > -0.03:
            return "Hampir paras tertinggi 52 minggu"
        return f"{abs(pct):.0f}% di bawah paras tertinggi 52 minggu"
    return None
