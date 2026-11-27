// Logik semakan yang dikongsi oleh tugas latar belakang dan app (latar depan).
import { muatData } from './data';
import { DataTerkini, Horizon, Penemuan, SEMUA_HORIZON, Sisi, Tetapan } from './jenis';
import { adaVersiBaru, semakVersi } from './kemaskini';
import { hantarPenemuan, hantarSistem, hantarVersiBaru } from './notifikasi';
import { kemaskiniPilihan, LABEL_STATUS, untungPeratus } from './pelan';
import {
  bacaBinaDimaklum,
  simpanBinaDimaklum,
  bacaCache,
  bacaEtag,
  bacaPilihan,
  simpanEtag,
  simpanPilihan,
  bacaKeputusanDimaklum,
  bacaTarikhDimaklum,
  bacaTetapan,
  bacaToken,
  simpanCache,
  simpanKeputusanDimaklum,
  simpanSemakanTerakhir,
  simpanTarikhDimaklum,
  simpanTetapan,
  tambahLog,
} from './storan';
import { INFO_HORIZON } from './tema';

export interface HasilSemakan {
  data: DataTerkini | null;
  tetapan: Tetapan;
  ralat?: string;
  dimaklum: number;
  dataBaru: boolean;
}

export function kiraPemantauan(t: Tetapan, d: DataTerkini | null) {
  const tempoh = Math.max(0, t.tempohHari);
  if (tempoh === 0) return { hariKe: 0, tempoh, selesai: true };
  if (!t.mulaTarikh || !d) return { hariKe: 0, tempoh, selesai: false };
  const hari = (d.tarikh_larian ?? []).filter((x) => x >= t.mulaTarikh!).length;
  return { hariKe: Math.min(hari, tempoh), tempoh, selesai: hari >= tempoh };
}

export interface Ketepatan {
  n: number;
  kena: number;
  kadar: number | null;
}

/** Ketepatan ranking sejak tarikh `mula` (berdasarkan pilihan yang sudah dinilai). */
export function ketepatanSejak(d: DataTerkini | null, mula: string | null): Record<Horizon, Record<Sisi, Ketepatan>> {
  const hasil = {} as Record<Horizon, Record<Sisi, Ketepatan>>;
  SEMUA_HORIZON.forEach((h) => {
    hasil[h] = { bullish: { n: 0, kena: 0, kadar: null }, bearish: { n: 0, kena: 0, kadar: null } };
    (d?.pilihan_lepas?.[h] ?? [])
      .filter((p) => !mula || p.tarikh >= mula)
      .forEach((p) => {
        const k = hasil[h][p.sisi];
        k.n += 1;
        k.kena += p.kena ? 1 : 0;
      });
    (['bullish', 'bearish'] as Sisi[]).forEach((s) => {
      const k = hasil[h][s];
      k.kadar = k.n ? Math.round((1000 * k.kena) / k.n) / 10 : null;
    });
  });
  return hasil;
}

export function tapisPenemuan(t: Tetapan, d: DataTerkini): Penemuan[] {
  return (d.penemuan_baru ?? []).filter(
    (p) => t.horizonNotifikasi.includes(p.horizon) && t.sisiNotifikasi.includes(p.sisi) && p.kedudukan <= t.hadKedudukan
  );
}

function teksKetepatan(d: DataTerkini, t: Tetapan) {
  const k = ketepatanSejak(d, t.mulaTarikh);
  return t.horizonNotifikasi
    .map((h) => {
      const b = k[h].bullish;
      const r = k[h].bearish;
      const n = b.n + r.n;
      const kadar = n ? Math.round((100 * (b.kena + r.kena)) / n) : null;
      return `${INFO_HORIZON[h].label}: ${kadar == null ? 'belum cukup data' : `${kadar}% tepat (${n} pilihan)`}`;
    })
    .join(' · ');
}

export async function semakSekarang(): Promise<HasilSemakan> {
  const tetapan = await bacaTetapan();
  const kini = new Date().toISOString();
  if (!tetapan.sudahMula) return { data: await bacaCache(), tetapan, dimaklum: 0, dataBaru: false };

  // Versi app baru? Maklumkan sekali sahaja bagi setiap bina
  try {
    const v = await semakVersi(tetapan.repo);
    if (adaVersiBaru(v) && v.bina > (await bacaBinaDimaklum())) {
      await hantarVersiBaru(v.versi, v.bina, v.url);
      await simpanBinaDimaklum(v.bina);
    }
  } catch {
    // abaikan — semakan versi tidak kritikal
  }

  let data: DataTerkini;
  const lama = await bacaCache();
  try {
    const h = await muatData(tetapan, await bacaToken(), lama ? await bacaEtag() : '');
    if (h.tidakBerubah && lama) {
      await simpanSemakanTerakhir(kini);
      return { data: lama, tetapan, dimaklum: 0, dataBaru: false };
    }
    data = h.data!;
    await simpanEtag(h.etag);
  } catch (e) {
    return { data: lama, tetapan, ralat: (e as Error).message, dimaklum: 0, dataBaru: false };
  }
  const dataBaru = !lama || lama.id_larian !== data.id_larian;
  await simpanCache(data);
  await simpanSemakanTerakhir(kini);

  // Pilihan Saya: kemas kini harga & status, maklumkan jika sasaran/henti rugi/tamat tempoh
  const pilihan = await bacaPilihan();
  if (pilihan.length) {
    const { senarai, berubah } = kemaskiniPilihan(pilihan, data);
    await simpanPilihan(senarai);
    for (const p of berubah) {
      const u = untungPeratus(p);
      await hantarSistem(
        `${p.nama} · ${LABEL_STATUS[p.status]}`,
        `${INFO_HORIZON[p.horizon].label}: masuk RM${p.harga_masuk} → tutup RM${p.harga_semasa} (${u >= 0 ? '+' : ''}${u.toFixed(2)}%).`,
        'cadangan'
      );
    }
  }

  let ubahTetapan = false;
  if (!tetapan.mulaTarikh) {
    tetapan.mulaTarikh = data.tarikh_data;
    ubahTetapan = true;
  }
  if (data.penemuan_baru?.length && !data.sampel) {
    await tambahLog({ tarikh: data.tarikh_data, diterima: kini, item: data.penemuan_baru });
  }

  // Peralihan fasa: tamat tempoh pemantauan -> minta keputusan pengguna
  const pm = kiraPemantauan(tetapan, data);
  if (tetapan.fasa === 'pemantauan' && pm.selesai) {
    tetapan.fasa = 'keputusan';
    ubahTetapan = true;
    if (!(await bacaKeputusanDimaklum())) {
      await hantarSistem(
        'BursaEdge · tempoh pemantauan selesai',
        `${pm.tempoh} hari dagangan dipantau. ${teksKetepatan(data, tetapan)}. Buka app untuk teruskan notifikasi penemuan baru.`,
        'ranking'
      );
      await simpanKeputusanDimaklum(true);
    }
  }
  if (ubahTetapan) await simpanTetapan(tetapan);

  // Notifikasi penemuan baru — sekali sahaja bagi setiap tarikh data
  let dimaklum = 0;
  const tarikhDimaklum = await bacaTarikhDimaklum();
  if (tarikhDimaklum !== data.tarikh_data) {
    const pertamaKali = tarikhDimaklum === '';
    const boleh = tetapan.fasa === 'aktif' || (tetapan.fasa === 'pemantauan' && tetapan.maklumSemasaPemantauan);
    if (boleh && !pertamaKali && !data.sampel) {
      const item = tapisPenemuan(tetapan, data);
      if (item.length) dimaklum = await hantarPenemuan(item, data.tarikh_data);
    }
    await simpanTarikhDimaklum(data.tarikh_data);
  }
  return { data, tetapan, dimaklum, dataBaru };
}
