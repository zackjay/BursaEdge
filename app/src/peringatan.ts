// Jadual peringatan beli (pagi) & jual (sebelum tutup) serta amaran apabila untung ≥ ambang R.
// Dipanggil daripada semakan latar belakang, apabila app dibuka dan apabila tetapan/pilihan berubah.
import { muatHargaLangsung } from './hargaLangsung';
import { DataTerkini } from './jenis';
import { batalJadual, hantarPeringatan, ID_BELI, ID_JUAL, jadualPada, kebenaranAda } from './notifikasi';
import {
  epochMYT,
  fmtHari,
  fmtJam,
  hariDagangan,
  hariDaganganSeterusnya,
  HargaLangsung,
  mesejAmaranR,
  mesejBeli,
  mesejJual,
  minitMYT,
  nilaiItem,
  senaraiPantau,
  tarikhMYT,
} from './peringatanLogik';
import { bacaCache, bacaKeadaanPeringatan, bacaPilihan, bacaTetapan, simpanKeadaanPeringatan } from './storan';

export async function jadualPeringatan(dataDiberi?: DataTerkini | null, kini = Date.now()): Promise<void> {
  const tetapan = await bacaTetapan();
  const t = tetapan.peringatan;
  const k = await bacaKeadaanPeringatan();
  if (!t.aktif || !tetapan.sudahMula || !(await kebenaranAda())) {
    await batalJadual(ID_BELI);
    await batalJadual(ID_JUAL);
    await simpanKeadaanPeringatan({ ...k, beliUntuk: undefined, beliRingkas: undefined, jualUntuk: undefined, jualRingkas: undefined });
    return;
  }
  const data = dataDiberi ?? (await bacaCache());
  if (!data || data.sampel) return;
  const pilihan = await bacaPilihan();
  const hariIni = tarikhMYT(kini);
  const minit = minitMYT(kini);

  // ---- Peringatan BELI: sesi selepas tarikh data ----
  const sesiBeli = hariDaganganSeterusnya(data.tarikh_data);
  const bilaBeli = epochMYT(sesiBeli, t.masaBeli);
  const mb = mesejBeli(data, t, pilihan, k.beliDimaklum);
  if (mb && kini < bilaBeli) {
    await jadualPada(ID_BELI, bilaBeli, mb.tajuk, mb.badan, t.penggera);
    k.beliUntuk = sesiBeli;
    k.beliRingkas = `${fmtHari(sesiBeli)} ${fmtJam(t.masaBeli)} · ${mb.bil} saham`;
    if (!k.beliDimaklum.includes(data.tarikh_data)) k.beliDimaklum = [...k.beliDimaklum, data.tarikh_data].slice(-60);
  } else if (mb && hariIni === sesiBeli && kini < epochMYT(sesiBeli, '16:00') && k.beliUntuk !== sesiBeli) {
    // Data tiba selepas masa peringatan — hantar terus
    await hantarPeringatan(`${mb.tajuk} — lewat`, mb.badan);
    k.beliUntuk = sesiBeli;
    k.beliRingkas = `dihantar ${fmtHari(sesiBeli)} (data tiba lewat)`;
    if (!k.beliDimaklum.includes(data.tarikh_data)) k.beliDimaklum = [...k.beliDimaklum, data.tarikh_data].slice(-60);
  } else if (!mb && kini < bilaBeli) {
    await batalJadual(ID_BELI);
    k.beliRingkas = undefined;
    k.beliUntuk = undefined;
  } else if (kini >= bilaBeli && k.beliUntuk && k.beliUntuk < hariIni) {
    k.beliRingkas = undefined;
  }

  // ---- Peringatan JUAL & amaran untung: sesi hari ini ----
  const pantau = senaraiPantau(data, t, pilihan, k.beliDimaklum);
  const sesiHariIni = hariDagangan(hariIni) && hariIni > data.tarikh_data;
  let langsung: Record<string, HargaLangsung> = {};
  if (sesiHariIni && pantau.length && minit >= 9 * 60 + 5 && minit <= 17 * 60 + 15) {
    try {
      langsung = await muatHargaLangsung(pantau.map((p) => p.ticker));
      const ada = pantau.filter((p) => langsung[p.ticker] && tarikhMYT(langsung[p.ticker].masa * 1000) === hariIni).length;
      k.langsungInfo = `${ada}/${pantau.length} saham · ${fmtJam(`${Math.floor(minit / 60)}:${String(minit % 60).padStart(2, '0')}`)}`;
    } catch {
      k.langsungInfo = 'tidak tersedia';
    }
  }
  if (sesiHariIni && pantau.length) {
    const nilai = pantau.map((p) => nilaiItem(p, hariIni, data.tarikh_data, t.ambangR, langsung[p.ticker]));
    const bilaJual = epochMYT(hariIni, t.masaJual);
    const mj = mesejJual(nilai, t.masaJual);
    if (kini < bilaJual) {
      if (mj) {
        await jadualPada(ID_JUAL, bilaJual, mj.tajuk, mj.badan, t.penggera);
        k.jualUntuk = hariIni;
        k.jualRingkas = `${fmtHari(hariIni)} ${fmtJam(t.masaJual)} · ${mj.bil} saham`;
      } else {
        await batalJadual(ID_JUAL);
        k.jualRingkas = undefined;
      }
    } else {
      k.jualRingkas = undefined;
    }
    // Amaran serta-merta apabila harga langsung mencapai ambang untung / sasaran (sekali sehari bagi setiap saham)
    if (minit >= 9 * 60 && minit <= 16 * 60 + 50) {
      const am = k.amaran?.tarikh === hariIni ? k.amaran : { tarikh: hariIni, kunci: [] };
      const baru = nilai.filter((p) => p.langsung && (p.sebab === 'untung' || p.sebab === 'sasaran') && !am.kunci.includes(p.item.kunci));
      const ma = mesejAmaranR(baru);
      if (ma) {
        await hantarPeringatan(ma.tajuk, ma.badan);
        am.kunci = [...am.kunci, ...baru.map((p) => p.item.kunci)];
      }
      k.amaran = am;
    }
  } else if (!pantau.length) {
    await batalJadual(ID_JUAL);
    k.jualRingkas = undefined;
  }
  k.dikemas = new Date(kini).toISOString();
  await simpanKeadaanPeringatan(k);
}

/** Peringatan contoh dalam `saat` saat — untuk mengesahkan penghantaran tepat masa pada telefon. */
export async function ujiPeringatan(saat = 60): Promise<string> {
  const tetapan = await bacaTetapan();
  const data = await bacaCache();
  const k = await bacaKeadaanPeringatan();
  const mb = data ? mesejBeli(data, { ...tetapan.peringatan, skop: 'semua' }, await bacaPilihan(), k.beliDimaklum) : null;
  const bila = Date.now() + saat * 1000;
  await jadualPada(
    'be-peringatan-uji',
    bila,
    mb ? `[UJIAN] ${mb.tajuk}` : '[UJIAN] BursaEdge · Peringatan',
    mb ? mb.badan : 'Peringatan beli & jual akan muncul seperti ini pada masa yang ditetapkan.',
    tetapan.peringatan.penggera
  );
  return fmtJam(`${Math.floor(minitMYT(bila) / 60)}:${String(minitMYT(bila) % 60).padStart(2, '0')}`);
}
