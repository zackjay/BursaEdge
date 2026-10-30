"""Penunjuk teknikal asas (pandas). Semua fungsi menerima Series harga dan pulangkan Series."""
from __future__ import annotations

import numpy as np
import pandas as pd


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False, min_periods=n).mean()


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    """RSI Wilder."""
    beza = close.diff()
    naik = beza.clip(lower=0.0)
    turun = (-beza).clip(lower=0.0)
    purata_naik = naik.ewm(alpha=1.0 / n, adjust=False, min_periods=n).mean()
    purata_turun = turun.ewm(alpha=1.0 / n, adjust=False, min_periods=n).mean()
    rs = purata_naik / purata_turun.replace(0.0, np.nan)
    hasil = 100.0 - 100.0 / (1.0 + rs)
    # Tiada penurunan langsung -> RSI 100
    hasil = hasil.where(purata_turun > 0, 100.0)
    return hasil


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    tinggi, rendah, tutup = df["High"], df["Low"], df["Close"]
    tutup_semalam = tutup.shift(1)
    tr = pd.concat(
        [tinggi - rendah, (tinggi - tutup_semalam).abs(), (rendah - tutup_semalam).abs()],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1.0 / n, adjust=False, min_periods=n).mean()


def macd_hist(close: pd.Series, cepat: int = 12, perlahan: int = 26, isyarat: int = 9) -> pd.Series:
    garis = ema(close, cepat) - ema(close, perlahan)
    return garis - ema(garis, isyarat)


def bundar_tik(harga: float) -> float:
    """Bundarkan harga kepada saiz tik Bursa Malaysia."""
    if harga is None or not np.isfinite(harga) or harga <= 0:
        return float("nan")
    if harga < 1.0:
        tik = 0.005
    elif harga < 10.0:
        tik = 0.01
    elif harga < 100.0:
        tik = 0.02
    else:
        tik = 0.10
    return round(round(harga / tik) * tik, 3)
