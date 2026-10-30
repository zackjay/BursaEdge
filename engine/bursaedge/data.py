"""Muat turun data harga harian (Yahoo Finance melalui yfinance) atau jana data sampel."""
from __future__ import annotations

import logging
import time
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

log = logging.getLogger("bursaedge.data")
LAJUR = ["Open", "High", "Low", "Close", "Volume"]


def _bersih(df: pd.DataFrame) -> pd.DataFrame:
    df = df[[c for c in LAJUR if c in df.columns]].copy()
    if "Close" not in df.columns:
        return pd.DataFrame()
    df = df.dropna(subset=["Close"])
    df = df[df["Close"] > 0]
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    df.index = pd.to_datetime(df.index).normalize()
    df = df[~df.index.duplicated(keep="last")].sort_index()
    for c in ("Open", "High", "Low"):
        if c in df.columns:
            df[c] = df[c].fillna(df["Close"])
    if "Volume" in df.columns:
        df["Volume"] = df["Volume"].fillna(0)
    return df


def muat_turun(tickers: List[str], tempoh: str = "10y", saiz_kumpulan: int = 40, cubaan: int = 3) -> Tuple[Dict[str, pd.DataFrame], List[str]]:
    import yfinance as yf  # import lewat supaya mod sampel tidak perlukan yfinance

    hasil: Dict[str, pd.DataFrame] = {}
    for mula in range(0, len(tickers), saiz_kumpulan):
        kumpulan = tickers[mula : mula + saiz_kumpulan]
        for n in range(cubaan):
            try:
                df = yf.download(
                    kumpulan,
                    period=tempoh,
                    interval="1d",
                    group_by="ticker",
                    auto_adjust=True,
                    threads=True,
                    progress=False,
                )
                break
            except Exception as e:  # noqa: BLE001
                log.warning("Muat turun gagal (cubaan %d): %s", n + 1, e)
                time.sleep(5 * (n + 1))
                df = None
        if df is None or df.empty:
            continue
        for t in kumpulan:
            try:
                if isinstance(df.columns, pd.MultiIndex):
                    if t in df.columns.get_level_values(0):
                        sub = df[t]
                    elif t in df.columns.get_level_values(-1):
                        sub = df.xs(t, axis=1, level=-1)
                    else:
                        continue
                else:
                    sub = df
                sub = _bersih(sub)
                if len(sub) >= 30:
                    hasil[t] = sub
            except Exception as e:  # noqa: BLE001
                log.warning("Gagal proses %s: %s", t, e)
        time.sleep(1)
    gagal = [t for t in tickers if t not in hasil]
    return hasil, gagal


def data_sampel(tickers: List[str], tarikh_akhir: str, tahun: int = 10, benih: int = 7) -> Dict[str, pd.DataFrame]:
    """Data rawak (random walk) untuk ujian luar talian. BUKAN data pasaran sebenar."""
    # Siri tetap (2016–2027) dipotong pada tarikh_akhir supaya larian berturutan konsisten
    hari = pd.bdate_range("2016-01-01", "2027-12-31")
    potong = int(hari.searchsorted(pd.Timestamp(tarikh_akhir), side="right"))
    hasil = {}
    for k, t in enumerate(tickers):
        rng = np.random.default_rng(benih * 1000 + k)
        drift = rng.normal(0.0002, 0.0004)
        vol = rng.uniform(0.01, 0.03)
        musim = rng.normal(0, 0.002) * np.sin(2 * np.pi * hari.dayofyear / 365.25 + rng.uniform(0, 6.28))
        r = rng.normal(drift, vol, len(hari)) + musim
        tutup = 2.0 * np.exp(np.cumsum(r)) * rng.uniform(0.3, 10)
        buka = tutup * (1 + rng.normal(0, vol / 3, len(hari)))
        tinggi = np.maximum(tutup, buka) * (1 + np.abs(rng.normal(0, vol / 2, len(hari))))
        rendah = np.minimum(tutup, buka) * (1 - np.abs(rng.normal(0, vol / 2, len(hari))))
        volum = rng.lognormal(14, 0.6, len(hari)) * (1 + 3 * (np.abs(r) > 2 * vol))
        hasil[t] = pd.DataFrame(
            {"Open": buka, "High": tinggi, "Low": rendah, "Close": tutup, "Volume": volum}, index=hari
        ).iloc[:potong]
    return hasil
