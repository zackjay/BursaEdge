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
  // v3.1
  henti_rugi_atr?: number;
  sasaran_r?: number;
  pegangan_hari?: number;
  cadangan?: CadanganHorizon;
  prestasi_cadangan?: PrestasiCadangan;
}

export type Tindakan = 'BELI' | 'ELAK';

export interface PelanCadangan {
  ticker: string;
  kod: string;
  nama: string;
  sektor: string;
  tindakan: Tindakan;
  gred: 'A' | 'B' | 'C';
  markah: number;
  kedudukan: number;
  skor: number;
  keyakinan: number;
  harga: number;
  ubah_peratus: number | null;
  zon_masuk: [number, number];
  henti_rugi: number;
  sasaran: number;
  risiko_peratus: number;
  ganjaran_peratus: number;
  nisbah_rr: number;
  atr_peratus: number | null;
  alasan: string[];
  selari: string[];
}

export interface CadanganHorizon {
  beli: PelanCadangan[];
  elak: PelanCadangan[];
  nota: string[];
  pegangan_hari: number;
  sah_hingga: string;
}

export interface StatCadangan {
  n: number;
  kadar_menang: number | null;
  purata_r: number | null;
  sasaran: number;
  henti: number;
  tamat: number;
  ujian_balik?: number;
}

export interface PrestasiCadangan {
  beli: StatCadangan;
  elak: StatCadangan;
  belum_dinilai: number;
  ujian_balik_dari?: string | null;
  ujian_balik_hingga?: string | null;
}

export interface CadanganDinilai {
  tarikh: string;
  horizon: Horizon;
  tindakan: Tindakan;
  ticker: string;
  kod: string;
  nama: string;
  gred: string;
  harga: number;
  henti_rugi: number;
  sasaran: number;
  pegangan: number;
  hasil: 'sasaran' | 'henti' | 'tamat';
  keluar: number;
  r: number;
  pulangan: number;
  tarikh_tutup: string;
  ujian_balik?: boolean;
}

export interface SahamRingkas {
  ticker: string;
  kod: string;
  nama: string;
  sektor: string;
  harga: number | null;
  ubah_peratus: number | null;
  ubah_5h: number | null;
  ubah_21h: number | null;
  ubah_252h: number | null;
  atr: number | null;
  atr_peratus: number | null;
  nilai_dagangan_rm: number | null;
  tinggi52: number | null;
  rendah52: number | null;
  spark: number[];
  status: Partial<Record<Horizon, { sisi: Sisi; kedudukan: number }>>;
  skor: Partial<Record<Horizon, number>>;
}

export type KunciJulat = 'hari' | 'minggu' | 'bulan' | 'tahun' | 'maks';

export interface SiriHarga {
  jenis: 'intraday' | 'harian' | 'mingguan';
  t: number[];
  c: number[];
  v?: number[];
  rujukan: number;
  tinggi: number;
  rendah: number;
  ubah_peratus: number | null;
  tarikh?: string;
}

export interface DataCarta {
  kod: string;
  nama: string;
  sektor: string;
  tarikh_data: string;
  dijana_pada: string;
  mula_data: string | null;
  julat: Partial<Record<KunciJulat, SiriHarga>>;
}

export type StatusPilihan = 'aktif' | 'sasaran' | 'henti' | 'tamat';

/** Saham yang dipilih pengguna untuk didagangkan (disimpan dalam telefon). */
export interface PilihanSaya {
  id: string;
  ticker: string;
  kod: string;
  nama: string;
  horizon: Horizon;
  tarikh: string;
  harga_masuk: number;
  henti_rugi: number;
  sasaran: number;
  pegangan_hari: number;
  gred?: string;
  dari_cadangan: boolean;
  status: StatusPilihan;
  harga_semasa?: number;
  tarikh_semasa?: string;
  tarikh_status?: string;
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
  // v3.1
  cadangan_lepas?: Record<Horizon, CadanganDinilai[]>;
  semua_saham?: SahamRingkas[];
  cawangan_carta?: string;
  harian_dari_intraday?: number;
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
