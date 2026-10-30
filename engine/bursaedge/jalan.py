"""Larian utama BursaEdge: muat turun data, analisa 3 horizon, kesan penemuan baru,
belajar daripada keputusan lepas, tulis JSON untuk app dan hantar notifikasi.

Contoh:
    python -m bursaedge.jalan                       # data sebenar (Yahoo Finance)
    python -m bursaedge.jalan --sampel --keluar /tmp/ujian   # data rawak untuk ujian
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd

from . import data as data_mod
from . import notifikasi
from . import pembelajaran as pb
from .faktor import LABEL_FAKTOR, kira_faktor, meta_asas
from .penunjuk import sma
from .skor import skor_horizon

log = logging.getLogger("bursaedge")
AKAR_ENJIN = Path(__file__).resolve().parent.parent
VERSI_SKEMA = 1


def _baca_json(laluan: Path, lalai):
    try:
        return json.loads(laluan.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return lalai


def _tulis_json(laluan: Path, data, padat: bool = False):
    laluan.parent.mkdir(parents=True, exist_ok=True)
    teks = json.dumps(data, ensure_ascii=False, separators=(",", ":") if padat else None, indent=None if padat else 1, allow_nan=False)
    laluan.write_text(teks, encoding="utf-8")


def _bersihkan_nan(x):
    if isinstance(x, float):
        return x if math.isfinite(x) else None
    if isinstance(x, dict):
        return {k: _bersihkan_nan(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_bersihkan_nan(v) for v in x]
    if isinstance(x, (np.floating,)):
        v = float(x)
        return v if math.isfinite(v) else None
    if isinstance(x, (np.integer,)):
        return int(x)
    return x


def ringkasan_pasaran(indeks_df, semua: Dict[str, pd.DataFrame], tarikh: str) -> dict:
    hasil = {"klci": None, "klci_ubah_peratus": None, "rejim": "tidak diketahui", "naik": 0, "turun": 0, "tidak_berubah": 0}
    if indeks_df is not None and len(indeks_df) > 200:
        c = indeks_df["Close"]
        hasil["klci"] = round(float(c.iloc[-1]), 2)
        hasil["klci_ubah_peratus"] = round(float(c.iloc[-1] / c.iloc[-2] - 1) * 100, 2)
        s50, s200 = float(sma(c, 50).iloc[-1]), float(sma(c, 200).iloc[-1])
        harga = float(c.iloc[-1])
        if harga > s50 > s200:
            hasil["rejim"] = "menaik"
        elif harga < s50 < s200:
            hasil["rejim"] = "menurun"
        else:
            hasil["rejim"] = "mendatar"
    for df in semua.values():
        if len(df) < 2 or df.index[-1].strftime("%Y-%m-%d") != tarikh:
            continue
        r = df["Close"].iloc[-1] / df["Close"].iloc[-2] - 1
        if r > 0.0005:
            hasil["naik"] += 1
        elif r < -0.0005:
            hasil["turun"] += 1
        else:
            hasil["tidak_berubah"] += 1
    return hasil


def kesan_perubahan(semasa: List[dict], sebelum: List[str], horizon: str, sisi: str, ambang: int) -> List[dict]:
    """Tanda status setiap item dan pulangkan senarai penemuan baru."""
    penemuan = []
    kedudukan_lama = {t: i + 1 for i, t in enumerate(sebelum)}
    for item in semasa:
        lama = kedudukan_lama.get(item["ticker"])
        item["kedudukan_sebelum"] = lama
        if not sebelum:
            item["status"] = "pertama"
            continue
        if lama is None:
            item["status"] = "baru"
            penemuan.append({"horizon": horizon, "sisi": sisi, "ticker": item["ticker"], "kod": item["kod"], "nama": item["nama"], "kedudukan": item["kedudukan"], "jenis": "baru", "dari": None})
        elif lama - item["kedudukan"] >= ambang:
            item["status"] = "naik"
            penemuan.append({"horizon": horizon, "sisi": sisi, "ticker": item["ticker"], "kod": item["kod"], "nama": item["nama"], "kedudukan": item["kedudukan"], "jenis": "naik", "dari": lama})
        elif lama > item["kedudukan"]:
            item["status"] = "naik_sedikit"
        elif lama < item["kedudukan"]:
            item["status"] = "turun"
        else:
            item["status"] = "kekal"
    return penemuan


def jalan(args) -> int:
    cfg = _baca_json(AKAR_ENJIN / "config.json", None)
    alam = _baca_json(AKAR_ENJIN / "universe.json", None)
    if not cfg or not alam:
        log.error("config.json atau universe.json tidak dijumpai")
        return 2
    keluar = Path(args.keluar).resolve()
    laluan_state = keluar / "state.json"
    state = _baca_json(laluan_state, {"versi": 1})

    maklumat = {f"{s['kod']}.KL": s for s in alam["saham"]}
    tickers = list(maklumat.keys())
    kod_indeks = cfg.get("indeks_rujukan", "^KLSE")

    # 1) Data
    if args.sampel:
        tarikh_akhir = args.sampel_tarikh or pd.Timestamp.today().strftime("%Y-%m-%d")
        semua = data_mod.data_sampel(tickers + [kod_indeks], tarikh_akhir)
        gagal = []
        sumber = "SAMPEL RAWAK (bukan data sebenar)"
    else:
        semua, gagal = data_mod.muat_turun(tickers + [kod_indeks], tempoh=cfg.get("tempoh_data", "10y"))
        sumber = "Yahoo Finance (yfinance), harga akhir hari"
    indeks_df = semua.pop(kod_indeks, None)
    gagal = [g for g in gagal if g != kod_indeks]
    if len(semua) < 20:
        log.error("Data tidak mencukupi (%d saham). Henti tanpa menulis.", len(semua))
        return 3

    # Tarikh data = tarikh dagangan terkini yang dikongsi kebanyakan saham
    tarikh_akhir_semua = Counter(df.index[-1].strftime("%Y-%m-%d") for df in semua.values())
    tarikh_data = max(d for d, n in tarikh_akhir_semua.items() if n >= max(5, len(semua) * 0.3))
    # Buang saham yang datanya basi (> 7 hari kalendar sebelum tarikh_data) — mungkin digantung
    had_basi = pd.Timestamp(tarikh_data) - pd.Timedelta(days=7)
    basi = [t for t, df in semua.items() if df.index[-1] < had_basi]
    for t in basi:
        semua.pop(t)
    # Data meragukan: lonjakan sehari > 35% (melebihi had harga Bursa) — biasanya
    # tindakan korporat belum dilaraskan atau ralat data. Keluarkan daripada analisa.
    meragukan = []
    for t, df in list(semua.items()):
        if len(df) >= 2 and abs(float(df["Close"].iloc[-1] / df["Close"].iloc[-2]) - 1.0) > 0.35:
            meragukan.append(t)
            semua.pop(t)
    harga_tutup = {t: df["Close"] for t, df in semua.items()}
    indeks_tutup = indeks_df["Close"] if indeks_df is not None else None

    larian_lama = state.get("tarikh_larian", [])
    hari_baru = tarikh_data not in larian_lama
    log.info("Tarikh data %s (%s), %d saham, %d gagal, %d basi, %d meragukan", tarikh_data, "baru" if hari_baru else "larian semula", len(semua), len(gagal), len(basi), len(meragukan))

    # 2) Belajar daripada keputusan lepas (sebelum skor hari ini)
    bil_ic = pb.kemas_kini_ic(state, cfg, harga_tutup)
    bil_pilihan = pb.nilai_pilihan(state, cfg, harga_tutup)
    pemberat = pb.pemberat_semasa(state, cfg)
    log.info("Pembelajaran: IC dinilai %s, pilihan dinilai %d", bil_ic, bil_pilihan)

    # 3) Faktor & ranking setiap horizon
    meta_semua = {t: meta_asas(df) for t, df in semua.items()}
    bilangan = int(cfg.get("bilangan_ranking", 10))
    ambang = int(cfg.get("ambang_naik_kedudukan", 2))
    ranking_hist = state.setdefault("ranking", {})
    tarikh_sebelum = sorted(d for d in ranking_hist if d < tarikh_data)
    rank_sebelum = ranking_hist.get(tarikh_sebelum[-1], {}) if tarikh_sebelum else {}

    hasil_horizon = {}
    z_simpan = {}
    penemuan: List[dict] = []
    rank_hari_ini = {}
    for h, cfg_h in cfg["horizon"].items():
        faktor, meta = {}, {}
        for t, df in semua.items():
            try:
                f, m = kira_faktor(h, df, indeks_tutup, cfg)
            except Exception as e:  # noqa: BLE001
                log.warning("Faktor %s/%s gagal: %s", h, t, e)
                continue
            if f:
                faktor[t] = f
                meta[t] = {**meta_semua[t], **m}
        bull, bear, z_semua = skor_horizon(h, cfg_h, pemberat[h], faktor, meta, maklumat, bilangan)
        sebelum = rank_sebelum.get(h, {})
        penemuan += kesan_perubahan(bull, sebelum.get("bullish", []), h, "bullish", ambang)
        penemuan += kesan_perubahan(bear, sebelum.get("bearish", []), h, "bearish", ambang)
        rank_hari_ini[h] = {"bullish": [x["ticker"] for x in bull], "bearish": [x["ticker"] for x in bear]}
        z_simpan[h] = z_semua
        pb.rekod_pilihan(state, tarikh_data, h, "bullish", bull)
        pb.rekod_pilihan(state, tarikh_data, h, "bearish", bear)
        hasil_horizon[h] = {
            "label": cfg_h["label"],
            "untuk": cfg_h["untuk"],
            "hari_hadapan": cfg_h["hari_hadapan"],
            "bilangan_layak": len(z_semua),
            "pemberat": pemberat[h],
            "pemberat_asas": cfg_h["faktor"],
            "ic": {k: round(v, 4) for k, v in state.get("ic_ema", {}).get(h, {}).items()},
            "hari_dipelajari": int(state.get("bilangan_ic", {}).get(h, 0)),
            "faktor_label": {k: LABEL_FAKTOR.get(k, k) for k in cfg_h["faktor"]},
            "bullish": bull,
            "bearish": bear,
            "prestasi": pb.ringkasan_prestasi(state, h),
        }

    # 4) Simpan keadaan
    ranking_hist[tarikh_data] = rank_hari_ini
    for d in sorted(ranking_hist)[:-15]:
        ranking_hist.pop(d, None)
    pb.simpan_snapshot(state, cfg, tarikh_data, z_simpan)
    if hari_baru:
        state["tarikh_larian"] = sorted(set(larian_lama + [tarikh_data]))[-250:]
    dijana = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    pilihan_lepas = {
        h: list(reversed(state.get("pilihan_dinilai", {}).get(h, [])))[:60] for h in cfg["horizon"]
    }
    latest = {
        "versi_skema": VERSI_SKEMA,
        "versi_enjin": cfg.get("versi", "3.0"),
        "id_larian": f"{tarikh_data}@{dijana}",
        "tarikh_data": tarikh_data,
        "dijana_pada": dijana,
        "sumber": sumber,
        "sampel": bool(args.sampel),
        "bilangan_saham_dianalisa": len(semua),
        "ticker_gagal": sorted(gagal + basi),
        "data_meragukan": sorted(meragukan),
        "tarikh_larian": state.get("tarikh_larian", [])[-60:],
        "pasaran": ringkasan_pasaran(indeks_df, semua, tarikh_data),
        "horizon": hasil_horizon,
        "penemuan_baru": penemuan,
        "pilihan_lepas": pilihan_lepas,
        "penafian": "Analisa teknikal automatik untuk rujukan sahaja. Bukan nasihat pelaburan.",
    }
    latest = _bersihkan_nan(latest)
    _tulis_json(keluar / "latest.json", latest, padat=True)
    ringkas = {k: v for k, v in latest.items() if k not in ("pilihan_lepas",)}
    ringkas["horizon"] = {
        h: {**v, "bullish": [{k: x[k] for k in x if k != "faktor_z"} for x in v["bullish"]], "bearish": [{k: x[k] for k in x if k != "faktor_z"} for x in v["bearish"]]}
        for h, v in latest["horizon"].items()
    }
    _tulis_json(keluar / "sejarah" / f"{tarikh_data}.json", ringkas, padat=True)
    _buang_sejarah_lama(keluar / "sejarah", 400)

    # 5) Notifikasi pelayan (Telegram / ntfy) — sekali sahaja bagi setiap tarikh data
    dimaklum = state.setdefault("dimaklum", [])
    boleh = (hari_baru or args.paksa_notifikasi) and not args.tanpa_notifikasi and not args.sampel
    if boleh and penemuan and (tarikh_data not in dimaklum or args.paksa_notifikasi):
        hasil = notifikasi.hantar(penemuan, tarikh_data, os.getenv("PAUTAN_APP", ""))
        log.info("Notifikasi: %s", hasil)
        if hasil["telegram"] or hasil["ntfy"]:
            dimaklum.append(tarikh_data)
            state["dimaklum"] = dimaklum[-60:]
    _tulis_json(laluan_state, _bersihkan_nan(state), padat=True)

    print(f"OK tarikh={tarikh_data} saham={len(semua)} penemuan_baru={len(penemuan)} gagal={len(gagal)}")
    for h, v in hasil_horizon.items():
        atas = ", ".join(x["nama"] for x in v["bullish"][:3])
        bawah = ", ".join(x["nama"] for x in v["bearish"][:3])
        print(f"  {v['label']:<9} bullish: {atas} | bearish: {bawah}")
    return 0


def _buang_sejarah_lama(folder: Path, simpan: int):
    if not folder.exists():
        return
    fail = sorted(folder.glob("*.json"))
    for f in fail[:-simpan]:
        f.unlink(missing_ok=True)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Enjin analisa BursaEdge")
    ap.add_argument("--keluar", default=str(AKAR_ENJIN.parent / "data"), help="Folder output (lalai: ../data)")
    ap.add_argument("--sampel", action="store_true", help="Guna data rawak untuk ujian luar talian")
    ap.add_argument("--sampel-tarikh", default=None, help="Tarikh akhir data sampel (YYYY-MM-DD)")
    ap.add_argument("--tanpa-notifikasi", action="store_true")
    ap.add_argument("--paksa-notifikasi", action="store_true", help="Hantar walaupun tarikh sudah dimaklumkan")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    return jalan(args)


if __name__ == "__main__":
    sys.exit(main())
