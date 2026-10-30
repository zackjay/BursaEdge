// Jenis data yang dihasilkan oleh enjin (data/latest.json)

export type Horizon = 'harian' | 'mingguan' | 'musiman';
export type Sisi = 'bullish' | 'bearish';
export const SEMUA_HORIZON: Horizon[] = ['harian', 'mingguan', 'musiman'];

export interface Paras {
  masuk: number;
  henti_rugi: number;
  sasaran: number;
}

export type StatusItem = 'baru' | 'naik' | 'naik_sedikit' | 'turun' | 'kekal' | 'pertama';

export interface ItemRanking {
  kedudukan: number;
  ticker: string;
  kod: string;
  nama: string;
  sektor: string;
  harga: number;
  ubah_peratus: number | null;
  skor: number;
  komposit: number;
  keyakinan: number;
  atr_peratus: number;
  nilai_dagangan_rm: number;
  alasan: string[];
  paras: Paras | null;
  faktor_z?: Record<string, number>;
  kedudukan_sebelum: number | null;
  status: StatusItem;
}

export interface StatPrestasi {
  n: number;
  kadar_kena: number | null;
  purata_pulangan: number | null;
  purata_lebihan: number | null;
  kadar_kena_top3: number | null;
}

export interface DataHorizon {
  label: string;
  untuk: string;
  hari_hadapan: number;
  bilangan_layak: number;
  pemberat: Record<string, number>;
  pemberat_asas: Record<string, number>;
  ic: Record<string, number>;
  hari_dipelajari: number;
  faktor_label: Record<string, string>;
  bullish: ItemRanking[];
  bearish: ItemRanking[];
  prestasi: { bullish: StatPrestasi; bearish: StatPrestasi };
}

export interface Penemuan {
  horizon: Horizon;
  sisi: Sisi;
  ticker: string;
  kod: string;
  nama: string;
  kedudukan: number;
  jenis: 'baru' | 'naik';
  dari: number | null;
}

export interface PilihanDinilai {
  tarikh: string;
  horizon: Horizon;
  sisi: Sisi;
  ticker: string;
  kod: string;
  nama: string;
  kedudukan: number;
  harga: number;
  pulangan: number;
  lebihan: number;
  kena: boolean;
  tarikh_nilai: string;
}

export interface DataTerkini {
  versi_skema: number;
  versi_enjin: string;
  id_larian: string;
  tarikh_data: string;
  dijana_pada: string;
  sumber: string;
  sampel: boolean;
  bilangan_saham_dianalisa: number;
  ticker_gagal: string[];
  tarikh_larian: string[];
  pasaran: {
    klci: number | null;
    klci_ubah_peratus: number | null;
    rejim: string;
    naik: number;
    turun: number;
    tidak_berubah: number;
  };
  horizon: Record<Horizon, DataHorizon>;
  penemuan_baru: Penemuan[];
  pilihan_lepas: Record<Horizon, PilihanDinilai[]>;
  penafian: string;
}

// Tetapan pengguna (disimpan dalam peranti)
export type FasaNotifikasi = 'pemantauan' | 'keputusan' | 'aktif' | 'senyap';

export interface Tetapan {
  sudahMula: boolean;
  jenisUtama: Horizon;
  horizonNotifikasi: Horizon[];
  sisiNotifikasi: Sisi[];
  hadKedudukan: number;
  fasa: FasaNotifikasi;
  tempohHari: number;
  mulaTarikh: string | null;
  maklumSemasaPemantauan: boolean;
  repo: string;
  cawangan: string;
}

export interface LogPenemuan {
  tarikh: string;
  diterima: string;
  item: Penemuan[];
}
