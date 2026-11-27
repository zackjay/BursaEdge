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


ZON = "Asia/Kuala_Lumpur"


def _bersih_intraday(df: pd.DataFrame) -> pd.DataFrame:
    df = df[[c for c in LAJUR if c in df.columns]].copy()
    if "Close" not in df.columns:
        return pd.DataFrame()
    df = df.dropna(subset=["Close"])
    df = df[df["Close"] > 0]
    if df.empty:
        return df
    idx = pd.DatetimeIndex(df.index)
    if idx.tz is None:
        idx = idx.tz_localize("UTC")
    df.index = idx.tz_convert(ZON)
    df = df[~df.index.duplicated(keep="last")].sort_index()
    for c in ("Open", "High", "Low"):
        if c in df.columns:
            df[c] = df[c].fillna(df["Close"])
    if "Volume" in df.columns:
        df["Volume"] = df["Volume"].fillna(0)
    return df


def muat_turun_intraday(tickers: List[str], tempoh: str = "5d", selang: str = "5m", saiz_kumpulan: int = 40) -> Dict[str, pd.DataFrame]:
    """Bar intraday (zon waktu Malaysia) untuk graf '1 Hari'/'1 Minggu' dan untuk
    melengkapkan bar harian yang lewat dikemas kini oleh Yahoo."""
    import yfinance as yf

    hasil: Dict[str, pd.DataFrame] = {}
    for mula in range(0, len(tickers), saiz_kumpulan):
        kumpulan = tickers[mula : mula + saiz_kumpulan]
        df = None
        for n in range(2):
            try:
                df = yf.download(
                    kumpulan, period=tempoh, interval=selang, group_by="ticker",
                    auto_adjust=False, prepost=False, threads=True, progress=False,
                )
                break
            except Exception as e:  # noqa: BLE001
                log.warning("Muat turun intraday gagal (cubaan %d): %s", n + 1, e)
                time.sleep(5)
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
                sub = _bersih_intraday(sub)
                if len(sub) >= 5:
                    hasil[t] = sub
            except Exception as e:  # noqa: BLE001
                log.warning("Gagal proses intraday %s: %s", t, e)
        time.sleep(1)
    return hasil


def tarikh_tempatan(idx: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """Tarikh kalendar Malaysia (tanpa zon) bagi indeks intraday."""
    return idx.tz_localize(None).normalize()


def lengkapkan_harian(harian: Dict[str, pd.DataFrame], intraday: Dict[str, pd.DataFrame], kini: pd.Timestamp | None = None) -> List[str]:
    """Yahoo kadang-kadang lewat sehari menerbitkan bar harian Bursa. Bina bar
    harian bagi sesi yang sudah tamat daripada data intraday jika belum ada."""
    kini = kini or pd.Timestamp.now(tz=ZON)
    ditambah = []
    for t, idf in intraday.items():
        df = harian.get(t)
        if df is None or df.empty or idf.empty:
            continue
        akhir = df.index[-1]
        tarikh_i = tarikh_tempatan(idf.index)
        baris = {}
        for tarikh in sorted(set(tarikh_i)):
            if tarikh <= akhir:
                continue
            sesi = idf[tarikh_i == tarikh]
            bar_akhir = sesi.index[-1]
            tamat = (bar_akhir.hour * 60 + bar_akhir.minute >= 16 * 60 + 40) or (tarikh.date() < kini.date())
            if not tamat or len(sesi) < 12:
                continue
            baris[tarikh] = {
                "Open": float(sesi["Open"].iloc[0]),
                "High": float(sesi["High"].max()),
                "Low": float(sesi["Low"].min()),
                "Close": float(sesi["Close"].iloc[-1]),
                "Volume": float(sesi["Volume"].sum()),
            }
        if baris:
            tambahan = pd.DataFrame.from_dict(baris, orient="index")[df.columns.intersection(LAJUR)]
            harian[t] = pd.concat([df, tambahan]).sort_index()
            ditambah.append(t)
    return ditambah


def buang_sesi_belum_tamat(harian: Dict[str, pd.DataFrame], kini: pd.Timestamp | None = None) -> int:
    """Semasa pasaran masih dibuka, Yahoo memberi bar harian separa untuk hari ini.
    Bar itu bukan harga tutup sebenar — buang supaya analisa hanya guna sesi yang tamat."""
    kini = kini or pd.Timestamp.now(tz=ZON)
    if kini.hour * 60 + kini.minute >= 17 * 60 + 20:  # data Yahoo lewat ~15 minit
        return 0
    hari_ini = pd.Timestamp(kini.date())
    bil = 0
    for t, df in list(harian.items()):
        if len(df) and df.index[-1] >= hari_ini:
            harian[t] = df[df.index < hari_ini]
            bil += 1
    return bil


def intraday_sampel(harian: Dict[str, pd.DataFrame], hari: int = 5, benih: int = 11) -> Dict[str, pd.DataFrame]:
    """Intraday rawak 5 minit (09:00–12:30, 14:30–16:55) yang konsisten dengan bar harian sampel."""
    hasil = {}
    for k, (t, df) in enumerate(harian.items()):
        rng = np.random.default_rng(benih * 1000 + k)
        bahagian = []
        for tarikh, bar in df.tail(hari).iterrows():
            masa = list(pd.date_range(f"{tarikh.date()} 09:00", f"{tarikh.date()} 12:25", freq="5min")) + list(
                pd.date_range(f"{tarikh.date()} 14:30", f"{tarikh.date()} 16:55", freq="5min")
            )
            n = len(masa)
            laluan = np.linspace(bar["Open"], bar["Close"], n) + np.cumsum(rng.normal(0, bar["Close"] * 0.002, n))
            laluan[-1] = bar["Close"]
            laluan = np.clip(laluan, bar["Low"], bar["High"])
            bahagian.append(
                pd.DataFrame(
                    {
                        "Open": np.r_[bar["Open"], laluan[:-1]],
                        "High": laluan * 1.001,
                        "Low": laluan * 0.999,
                        "Close": laluan,
                        "Volume": np.full(n, bar["Volume"] / n),
                    },
                    index=pd.DatetimeIndex(masa).tz_localize(ZON),
                )
            )
        if bahagian:
            hasil[t] = pd.concat(bahagian)
    return hasil


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
