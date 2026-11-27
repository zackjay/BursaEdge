"""Fail data graf harga bagi setiap saham (dibaca oleh app).

Setiap fail <kod>.json mengandungi beberapa julat:
  hari   — bar 5 minit sesi dagangan terakhir (intraday)
  minggu — bar 30 minit bagi 5 sesi terakhir (intraday)
  bulan  — harga tutup harian ~22 hari dagangan
  tahun  — harga tutup harian ~252 hari dagangan
  maks   — harga tutup mingguan sejak data terawal yang ada (sejak disenaraikan
           atau sejak Yahoo mula merekod)
Masa disimpan sebagai saat epoch (UTC); app memaparkannya dalam waktu Malaysia.
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Dict, Optional

import pandas as pd

from .data import ZON, tarikh_tempatan

log = logging.getLogger("bursaedge.carta")
AGG = {"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"}


def _bundar(x: float) -> Optional[float]:
    x = float(x)
    if not math.isfinite(x):
        return None
    return float(f"{x:.5g}")


def _epoch(idx: pd.DatetimeIndex) -> list:
    if idx.tz is None:
        idx = idx.tz_localize(ZON)
    return [int(ts.timestamp()) for ts in idx]


def _siri(df: pd.DataFrame, rujukan: float, jenis: str, volum: bool = True) -> Optional[dict]:
    df = df.dropna(subset=["Close"])
    if len(df) < 2:
        return None
    c = [_bundar(x) for x in df["Close"]]
    akhir = c[-1]
    ruj = _bundar(rujukan) if rujukan and math.isfinite(rujukan) and rujukan > 0 else c[0]
    hasil = {
        "jenis": jenis,
        "t": _epoch(pd.DatetimeIndex(df.index)),
        "c": c,
        "rujukan": ruj,
        "tinggi": _bundar(df["High"].max()) if "High" in df else max(c),
        "rendah": _bundar(df["Low"].min()) if "Low" in df else min(c),
        "ubah_peratus": round((akhir / ruj - 1.0) * 100.0, 2) if ruj else None,
    }
    if volum and "Volume" in df:
        hasil["v"] = [int(max(0, v)) if math.isfinite(v) else 0 for v in df["Volume"]]
    return hasil


def _tutup_sebelum(harian: pd.DataFrame, tarikh: pd.Timestamp) -> float:
    sebelum = harian[harian.index < tarikh]
    return float(sebelum["Close"].iloc[-1]) if len(sebelum) else float("nan")


def bina_carta(info: dict, harian: pd.DataFrame, intraday: Optional[pd.DataFrame], tarikh_data: str, dijana: str) -> dict:
    julat: Dict[str, dict] = {}

    if intraday is not None and not intraday.empty:
        tarikh_i = tarikh_tempatan(intraday.index)
        unik = sorted(set(tarikh_i))
        hari_akhir = unik[-1]
        sesi = intraday[tarikh_i == hari_akhir]
        s = _siri(sesi, _tutup_sebelum(harian, hari_akhir), "intraday")
        if s:
            s["tarikh"] = hari_akhir.strftime("%Y-%m-%d")
            julat["hari"] = s
        lima = unik[-5:]
        m = intraday[tarikh_i.isin(lima)]
        m30 = m.resample("30min").agg(AGG).dropna(subset=["Close"])
        s = _siri(m30, _tutup_sebelum(harian, lima[0]), "intraday")
        if s:
            julat["minggu"] = s

    if len(harian) >= 3:
        b = harian.iloc[-22:]
        s = _siri(b, _tutup_sebelum(harian, b.index[0]), "harian")
        if s:
            julat["bulan"] = s
        y = harian.iloc[-252:]
        s = _siri(y, _tutup_sebelum(harian, y.index[0]), "harian")
        if s:
            julat["tahun"] = s
        # Bar mingguan, dilabel ikut hari dagangan terakhir minggu itu
        kunci = harian.index.to_period("W-FRI")
        w = harian.groupby(kunci).agg(AGG)
        w.index = pd.DatetimeIndex(harian.index.to_series().groupby(kunci).last().values)
        s = _siri(w, float(harian["Close"].iloc[0]), "mingguan", volum=False)
        if s:
            julat["maks"] = s

    return {
        "kod": info.get("kod"),
        "nama": info.get("nama"),
        "sektor": info.get("sektor"),
        "tarikh_data": tarikh_data,
        "dijana_pada": dijana,
        "mula_data": harian.index[0].strftime("%Y-%m-%d") if len(harian) else None,
        "julat": julat,
    }


def tulis_semua(folder: Path, maklumat: Dict[str, dict], harian: Dict[str, pd.DataFrame], intraday: Dict[str, pd.DataFrame], tarikh_data: str, dijana: str) -> int:
    folder.mkdir(parents=True, exist_ok=True)
    bil = 0
    for t, df in harian.items():
        info = maklumat.get(t)
        if not info:
            continue
        try:
            data = bina_carta(info, df, intraday.get(t), tarikh_data, dijana)
        except Exception as e:  # noqa: BLE001
            log.warning("Carta %s gagal: %s", t, e)
            continue
        (folder / f"{info['kod']}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
        bil += 1
    (folder / "README.md").write_text(
        "# Data graf BursaEdge\n\nCawangan ini ditulis semula setiap hari oleh aliran kerja *Analisa Harian*.\n"
        "Satu fail JSON bagi setiap saham (kod Bursa). Jangan sunting secara manual.\n",
        encoding="utf-8",
    )
    return bil
