// Logik tulen (tanpa React Native) untuk peringatan beli/jual — mudah diuji.
// Semua masa dikira dalam waktu Malaysia (UTC+8) tanpa bergantung pada zon telefon.
import { DataTerkini, Horizon, PilihanSaya, TetapanPeringatan } from './jenis';

const LABEL_H: Record<Horizon, string> = { harian: 'Harian', mingguan: 'Mingguan', musiman: 'Bulanan' };
const MS_MYT = 8 * 3600 * 1000;

export interface HargaLangsung {
  harga: number;
  masa: number; // saat epoch
  tinggi?: number | null;
  rendah?: number | null;
}

export const tarikhMYT = (ms: number) => new Date(ms + MS_MYT).toISOString().slice(0, 10);
export const minitMYT = (ms: number) => {
  const d = new Date(ms + MS_MYT);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
export const hariMinggu = (tarikh: string) => new Date(`${tarikh}T00:00:00Z`).getUTCDay();
export const hariDagangan = (tarikh: string) => {
  const h = hariMinggu(tarikh);
  return h >= 1 && h <= 5;
};
export function epochMYT(tarikh: string, hhmm: string) {
  const [j, m] = hhmm.split(':').map(Number);
  return new Date(`${tarikh}T00:00:00Z`).getTime() - MS_MYT + (j * 60 + m) * 60000;
}
export function tambahHari(tarikh: string, n: number) {
  return new Date(new Date(`${tarikh}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
}
export function hariDaganganSeterusnya(tarikh: string) {
  let t = tambahHari(tarikh, 1);
  while (!hariDagangan(t)) t = tambahHari(t, 1);
  return t;
}
/** Bilangan hari dagangan dalam (dari, hingga]. */
export function bilHariDagangan(dari: string, hingga: string) {
  let n = 0;
  for (let t = tambahHari(dari, 1); t <= hingga && n < 400; t = tambahHari(t, 1)) if (hariDagangan(t)) n++;
  return n;
}
export const fmtJam = (hhmm: string) => {
  const [j, m] = hhmm.split(':').map(Number);
  return `${j > 12 ? j - 12 : j}:${String(m).padStart(2, '0')} ${j < 12 ? 'pg' : 'ptg'}`;
};
const fmtJamEpoch = (saat: number) => {
  const m = minitMYT(saat * 1000);
  return fmtJam(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`);
};
const HARI = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];
const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
export const fmtHari = (tarikh: string) => `${HARI[hariMinggu(tarikh)]} ${Number(tarikh.slice(8))} ${BULAN[Number(tarikh.slice(5, 7)) - 1]}`;
const h3 = (n: number) => (n >= 1 ? n.toFixed(2) : n.toFixed(3));

/** Horizon yang rekod cadangan BELI-nya purata ≥ +1R (sekurang-kurangnya 10 cadangan). */
export function rekodKuat(data: DataTerkini, h: Horizon) {
  const b = data.horizon?.[h]?.prestasi_cadangan?.beli;
  return !!b && b.n >= 10 && (b.purata_r ?? -9) >= 1;
}

export interface Mesej {
  tajuk: string;
  badan: string;
  bil: number;
}

/** Kandungan peringatan BELI untuk sesi selepas `data.tarikh_data`. */
export function mesejBeli(data: DataTerkini, t: TetapanPeringatan, pilihan: PilihanSaya[], dimaklum: string[]): Mesej | null {
  const X = data.tarikh_data;
  const baris: string[] = [];
  let bil = 0;
  const sudah = new Set<string>();
  if (t.skop !== 'pilihan') {
    for (const h of t.horizon) {
      if (t.skop === 'rekod' && !rekodKuat(data, h)) continue;
      const beli = data.horizon?.[h]?.cadangan?.beli ?? [];
      if (!beli.length) continue;
      const bintang = rekodKuat(data, h) ? ' ⭐' : '';
      baris.push(`BELI ${LABEL_H[h]}${bintang}:`);
      for (const c of beli) {
        sudah.add(`${c.ticker}|${h}`);
        const dipilih = pilihan.some((p) => p.ticker === c.ticker && p.horizon === h && p.status === 'aktif');
        baris.push(`• ${c.nama}${dipilih ? ' ✓' : ''} ${h3(c.zon_masuk[0])}–${h3(c.zon_masuk[1])} · henti ${h3(c.henti_rugi)} · sasaran ${h3(c.sasaran)}`);
        bil++;
      }
    }
  }
  const baruDipilih = pilihan.filter((p) => p.status === 'aktif' && p.tarikh === X && !sudah.has(`${p.ticker}|${p.horizon}`));
  if (baruDipilih.length) {
    baris.push('Pilihan anda:');
    for (const p of baruDipilih) {
      baris.push(`• ${p.nama} (${LABEL_H[p.horizon]}) sekitar ${h3(p.harga_masuk)} · henti ${h3(p.henti_rugi)} · sasaran ${h3(p.sasaran)}`);
      bil++;
    }
  }
  const keluar: string[] = [];
  for (const p of pilihan) {
    if (p.status !== 'aktif' && p.tarikh_status === X) {
      keluar.push(`• ${p.nama}: ${p.status === 'sasaran' ? 'sasaran dicapai' : p.status === 'henti' ? 'henti rugi dicapai' : 'tempoh pegangan tamat'} pada tutup semalam`);
    }
  }
  if (t.skop !== 'pilihan') {
    for (const h of t.horizon) {
      for (const r of data.cadangan_lepas?.[h] ?? []) {
        if (r.tindakan !== 'BELI' || r.ujian_balik || r.tarikh_tutup !== X || !dimaklum.includes(r.tarikh)) continue;
        if (pilihan.some((p) => p.ticker === r.ticker && p.horizon === h)) continue;
        keluar.push(`• ${r.nama}: ${r.hasil === 'sasaran' ? 'sasaran dicapai' : r.hasil === 'henti' ? 'henti rugi dicapai' : 'tempoh tamat'} (${r.r > 0 ? '+' : ''}${r.r.toFixed(1)}R)`);
      }
    }
  }
  if (keluar.length) {
    baris.push('JUAL jika masih dipegang:', ...keluar);
    bil += keluar.length;
  }
  if (!bil) return null;
  return { tajuk: `BursaEdge · Masa beli (${bil} saham)`, badan: baris.join('\n'), bil };
}

export interface ItemPantau {
  kunci: string;
  ticker: string;
  nama: string;
  horizon: Horizon;
  sumber: 'pilihan' | 'cadangan';
  masuk: number;
  henti: number;
  sasaran: number;
  pegangan: number;
  hariKe: number; // sesi berlalu sejak tarikh cadangan, pada data terkini
  hargaTutup: number | null;
}

export function senaraiPantau(data: DataTerkini, t: TetapanPeringatan, pilihan: PilihanSaya[], dimaklum: string[]): ItemPantau[] {
  const hasil: ItemPantau[] = [];
  const ada = new Set<string>();
  const larian = data.tarikh_larian ?? [];
  for (const p of pilihan) {
    if (p.status !== 'aktif') continue;
    ada.add(`${p.ticker}|${p.horizon}`);
    hasil.push({
      kunci: `${p.ticker}|${p.horizon}|${p.tarikh}`,
      ticker: p.ticker,
      nama: p.nama,
      horizon: p.horizon,
      sumber: 'pilihan',
      masuk: p.harga_masuk,
      henti: p.henti_rugi,
      sasaran: p.sasaran,
      pegangan: p.pegangan_hari,
      hariKe: larian.filter((d) => d > p.tarikh).length,
      hargaTutup: p.harga_semasa ?? null,
    });
  }
  if (t.skop === 'pilihan') return hasil;
  for (const c of data.cadangan_terbuka ?? []) {
    if (!t.horizon.includes(c.horizon) || !dimaklum.includes(c.tarikh) || ada.has(`${c.ticker}|${c.horizon}`)) continue;
    ada.add(`${c.ticker}|${c.horizon}`);
    hasil.push({
      kunci: `${c.ticker}|${c.horizon}|${c.tarikh}`,
      ticker: c.ticker,
      nama: c.nama,
      horizon: c.horizon,
      sumber: 'cadangan',
      masuk: c.harga,
      henti: c.henti_rugi,
      sasaran: c.sasaran,
      pegangan: c.pegangan,
      hariKe: c.hari_ke,
      hargaTutup: c.harga_semasa,
    });
  }
  if (dimaklum.includes(data.tarikh_data)) {
    for (const h of t.horizon) {
      const cad = data.horizon?.[h]?.cadangan;
      for (const c of cad?.beli ?? []) {
        if (ada.has(`${c.ticker}|${h}`)) continue;
        hasil.push({
          kunci: `${c.ticker}|${h}|${data.tarikh_data}`,
          ticker: c.ticker,
          nama: c.nama,
          horizon: h,
          sumber: 'cadangan',
          masuk: c.harga,
          henti: c.henti_rugi,
          sasaran: c.sasaran,
          pegangan: cad!.pegangan_hari,
          hariKe: 0,
          hargaTutup: null,
        });
      }
    }
  }
  return hasil;
}

export interface Penilaian {
  item: ItemPantau;
  harga: number | null;
  langsung: boolean;
  masaHarga?: number;
  r: number | null;
  sebab: 'henti' | 'sasaran' | 'untung' | 'akhir' | null;
}

/** Nilai setiap item untuk sesi `sesi` (tarikh MYT) dengan harga langsung jika ada. */
export function nilaiItem(item: ItemPantau, sesi: string, tarikhData: string, ambangR: number, hl?: HargaLangsung): Penilaian {
  const langsung = !!hl && tarikhMYT(hl.masa * 1000) === sesi;
  const harga = langsung ? hl!.harga : item.hargaTutup;
  const risiko = item.masuk - item.henti;
  const r = harga != null && risiko > 0 ? (harga - item.masuk) / risiko : null;
  const sesiKe = item.hariKe + (sesi > tarikhData ? bilHariDagangan(tarikhData, sesi) : 0);
  let sebab: Penilaian['sebab'] = null;
  const rendah = langsung ? Math.min(hl!.rendah ?? hl!.harga, hl!.harga) : harga;
  const tinggi = langsung ? Math.max(hl!.tinggi ?? hl!.harga, hl!.harga) : harga;
  // Pada hari beli (sesi pertama), tinggi/rendah sehari mungkin berlaku sebelum belian — guna harga semasa sahaja
  const hariBeli = sesiKe <= 1;
  if ((hariBeli ? harga : rendah) != null && (hariBeli ? harga! : rendah!) <= item.henti) sebab = 'henti';
  else if ((hariBeli ? harga : tinggi) != null && (hariBeli ? harga! : tinggi!) >= item.sasaran) sebab = 'sasaran';
  else if (r != null && r >= ambangR) sebab = 'untung';
  else if (sesiKe >= item.pegangan) sebab = 'akhir';
  return { item, harga, langsung, masaHarga: langsung ? hl!.masa : undefined, r, sebab };
}

const teksR = (r: number | null) => (r == null ? '' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}R`);

function barisJual(p: Penilaian) {
  const h = p.harga != null ? `RM${h3(p.harga)}${p.langsung && p.masaHarga ? ` @ ${fmtJamEpoch(p.masaHarga)}` : ' tutup semalam'}` : '';
  const apa =
    p.sebab === 'henti'
      ? `henti rugi ${h3(p.item.henti)} disentuh — jual`
      : p.sebab === 'sasaran'
        ? `sasaran ${h3(p.item.sasaran)} dicapai — ambil untung`
        : p.sebab === 'untung'
          ? `${teksR(p.r)} — kunci untung / naikkan henti rugi`
          : `hari terakhir pegangan (${teksR(p.r)}) — jual sebelum tutup`;
  return `• ${p.item.nama} ${h}: ${apa}`;
}

export function mesejJual(nilai: Penilaian[], masaJual: string): Mesej | null {
  const perlu = nilai.filter((p) => p.sebab);
  if (!perlu.length) return null;
  const turutan = { henti: 0, sasaran: 1, untung: 2, akhir: 3 } as const;
  perlu.sort((a, b) => turutan[a.sebab!] - turutan[b.sebab!]);
  const lain = nilai.filter((p) => !p.sebab && p.item.sumber === 'pilihan');
  const baris = perlu.map(barisJual);
  if (lain.length) baris.push(`Lain-lain aktif: ${lain.map((p) => `${p.item.nama} ${teksR(p.r)}`).join(', ')}`);
  baris.push('Dagangan berterusan tamat 4:45 ptg; pasaran tutup 5:00 ptg.');
  return { tajuk: `BursaEdge · Masa jual (${perlu.length} saham) — sebelum 4:45 ptg`, badan: baris.join('\n'), bil: perlu.length };
}

export function mesejAmaranR(baru: Penilaian[]): Mesej | null {
  if (!baru.length) return null;
  const baris = baru.map(
    (p) => `• ${p.item.nama} RM${h3(p.harga!)}${p.masaHarga ? ` @ ${fmtJamEpoch(p.masaHarga)}` : ''}: ${p.sebab === 'sasaran' ? `sasaran ${h3(p.item.sasaran)} dicapai` : teksR(p.r)}`
  );
  baris.push('Pertimbang jual atau naikkan henti rugi ke harga masuk. Dagangan berterusan tamat 4:45 ptg.');
  return { tajuk: `BursaEdge · ${baru.map((p) => p.item.nama).slice(0, 3).join(', ')} capai ambang untung`, badan: baris.join('\n'), bil: baru.length };
}
