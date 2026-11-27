// Pelan dagangan & status "Pilihan Saya".
import { DataTerkini, Horizon, PelanCadangan, PilihanSaya, SahamRingkas, StatusPilihan } from './jenis';

const ASAS: Record<Horizon, { hentiAtr: number; r: number; pegangan: number }> = {
  harian: { hentiAtr: 1, r: 1.5, pegangan: 2 },
  mingguan: { hentiAtr: 2, r: 2, pegangan: 15 },
  musiman: { hentiAtr: 3, r: 2.5, pegangan: 42 },
};

/** Saiz tik harga Bursa Malaysia. */
export function bundarTik(harga: number) {
  if (!isFinite(harga) || harga <= 0) return harga;
  const tik = harga < 1 ? 0.005 : harga < 10 ? 0.01 : harga < 100 ? 0.02 : 0.1;
  return Math.round(Math.round(harga / tik) * tik * 1000) / 1000;
}

export interface Pelan {
  masuk: number;
  henti: number;
  sasaran: number;
  pegangan: number;
  gred?: string;
  dariCadangan: boolean;
}

export function cariCadangan(data: DataTerkini | null, h: Horizon, ticker: string): PelanCadangan | undefined {
  const c = data?.horizon?.[h]?.cadangan;
  return c?.beli.find((x) => x.ticker === ticker) ?? c?.elak.find((x) => x.ticker === ticker);
}

/** Pelan beli bagi saham pada horizon tertentu: guna cadangan enjin jika ada,
 *  jika tidak kira daripada ATR mengikut tetapan horizon itu. */
export function rancangPelan(data: DataTerkini | null, h: Horizon, saham: SahamRingkas): Pelan | null {
  const cad = data?.horizon?.[h]?.cadangan;
  const c = cad?.beli.find((x) => x.ticker === saham.ticker);
  if (c) return { masuk: c.harga, henti: c.henti_rugi, sasaran: c.sasaran, pegangan: cad!.pegangan_hari, gred: c.gred, dariCadangan: true };
  const harga = saham.harga;
  const atr = saham.atr;
  if (!harga || !atr || atr <= 0) return null;
  const dh = data?.horizon?.[h];
  const hentiAtr = dh?.henti_rugi_atr ?? ASAS[h].hentiAtr;
  const r = dh?.sasaran_r ?? ASAS[h].r;
  return {
    masuk: harga,
    henti: bundarTik(Math.max(0.005, harga - hentiAtr * atr)),
    sasaran: bundarTik(harga + hentiAtr * atr * r),
    pegangan: dh?.pegangan_hari ?? ASAS[h].pegangan,
    dariCadangan: false,
  };
}

export function hariDipegang(p: PilihanSaya, data: DataTerkini | null) {
  return (data?.tarikh_larian ?? []).filter((d) => d > p.tarikh).length;
}

export function untungPeratus(p: PilihanSaya) {
  const kini = p.harga_semasa ?? p.harga_masuk;
  return ((kini - p.harga_masuk) / p.harga_masuk) * 100;
}

/** Kemaskini harga semasa & status (berdasarkan harga tutup harian). */
export function kemaskiniPilihan(senarai: PilihanSaya[], data: DataTerkini): { senarai: PilihanSaya[]; berubah: PilihanSaya[] } {
  const harga = new Map((data.semua_saham ?? []).map((s) => [s.ticker, s.harga]));
  const berubah: PilihanSaya[] = [];
  const baru = senarai.map((p) => {
    if (p.status !== 'aktif') return p;
    const h = harga.get(p.ticker);
    if (h == null) return p;
    let status: StatusPilihan = 'aktif';
    if (data.tarikh_data > p.tarikh) {
      if (h >= p.sasaran) status = 'sasaran';
      else if (h <= p.henti_rugi) status = 'henti';
      else if (hariDipegang(p, data) >= p.pegangan_hari) status = 'tamat';
    }
    const q: PilihanSaya = { ...p, harga_semasa: h, tarikh_semasa: data.tarikh_data };
    if (status !== 'aktif') {
      q.status = status;
      q.tarikh_status = data.tarikh_data;
      berubah.push(q);
    }
    return q;
  });
  return { senarai: baru, berubah };
}

export const LABEL_STATUS: Record<StatusPilihan, string> = {
  aktif: 'Aktif',
  sasaran: 'Sasaran dicapai',
  henti: 'Henti rugi',
  tamat: 'Tamat tempoh',
};
