// Anggaran kos urus niaga saham Bursa melalui moomoo Malaysia dan untung/rugi bersih.
// Kadar lalai (boleh diubah dalam Tetapan): komisen 0.03%, yuran platform RM3 setiap
// pesanan, yuran penjelasan Bursa 0.03% (maks RM1,000), duti setem RM1 bagi setiap
// RM1,000 atau sebahagiannya (maks RM1,000; REIT maks RM200), SST 8% atas komisen &
// yuran platform untuk REIT/ETF/waran sahaja. Semak jadual yuran rasmi moomoo.
import { TetapanKos } from './jenis';

export const KOS_ASAS: TetapanKos = { modal: 5000, komisenPeratus: 0.03, yuranPlatform: 3, komisenPercuma: false };
const UNIT_LOT = 100;

export interface KosSebelah {
  komisen: number;
  platform: number;
  penjelasan: number;
  setem: number;
  sst: number;
  jumlah: number;
}

const b2 = (x: number) => Math.round(x * 100) / 100;

export function kosSebelah(nilai: number, kos: TetapanKos, reit = false): KosSebelah {
  const komisen = kos.komisenPercuma ? 0 : b2((nilai * kos.komisenPeratus) / 100);
  const platform = kos.yuranPlatform;
  const penjelasan = b2(Math.min(nilai * 0.0003, 1000));
  const setem = Math.min(Math.ceil(nilai / 1000), reit ? 200 : 1000);
  const sst = reit ? b2((komisen + platform) * 0.08) : 0;
  return { komisen, platform, penjelasan, setem, sst, jumlah: b2(komisen + platform + penjelasan + setem + sst) };
}

export interface Anggaran {
  unit: number;
  lot: number;
  nilaiBeli: number;
  nilaiJual: number;
  kosBeli: KosSebelah;
  kosJual: KosSebelah;
  kos: number;
  kasar: number;
  bersih: number;
  bersihPeratus: number;
}

export function unitUntukModal(modal: number, harga: number) {
  if (!(harga > 0) || !(modal > 0)) return 0;
  return Math.floor(modal / (harga * UNIT_LOT)) * UNIT_LOT;
}

/** Untung/rugi bersih jika beli `unit` pada `masuk` dan jual pada `keluar`. */
export function anggar(unit: number, masuk: number, keluar: number, kos: TetapanKos, reit = false): Anggaran | null {
  if (!(unit > 0) || !(masuk > 0) || !(keluar > 0)) return null;
  const nilaiBeli = b2(unit * masuk);
  const nilaiJual = b2(unit * keluar);
  const kosBeli = kosSebelah(nilaiBeli, kos, reit);
  const kosJual = kosSebelah(nilaiJual, kos, reit);
  const jumlahKos = b2(kosBeli.jumlah + kosJual.jumlah);
  const kasar = b2(nilaiJual - nilaiBeli);
  const bersih = b2(kasar - jumlahKos);
  return {
    unit,
    lot: unit / UNIT_LOT,
    nilaiBeli,
    nilaiJual,
    kosBeli,
    kosJual,
    kos: jumlahKos,
    kasar,
    bersih,
    bersihPeratus: b2((bersih / (nilaiBeli + kosBeli.jumlah)) * 100),
  };
}

/** Kenaikan harga (%) yang diperlukan untuk pulang modal selepas kos beli + jual. */
export function pulangModalPeratus(unit: number, masuk: number, kos: TetapanKos, reit = false) {
  const a = anggar(unit, masuk, masuk, kos, reit);
  return a ? b2((a.kos / a.nilaiBeli) * 100) : null;
}

export const fmtRMx = (n: number | null | undefined) => {
  if (n == null || !isFinite(n)) return '—';
  const t = Math.abs(n) >= 1000 ? Math.abs(n).toLocaleString('en-MY', { maximumFractionDigits: 0 }) : Math.abs(n).toFixed(2);
  return `${n < 0 ? '−' : '+'}RM${t}`;
};
