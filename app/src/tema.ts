import { Horizon, Sisi } from './jenis';

export const warna = {
  latar: '#0A0F1C',
  kad: '#121A2B',
  kadTinggi: '#18223A',
  garis: '#22304D',
  teks: '#E8EEF8',
  teksLemah: '#8B98B0',
  teksMalap: '#5D6A84',
  bullish: '#22C55E',
  bullishLatar: 'rgba(34,197,94,0.14)',
  bearish: '#F04B4B',
  bearishLatar: 'rgba(240,75,75,0.14)',
  amaran: '#F5A524',
  amaranLatar: 'rgba(245,165,36,0.14)',
  aksen: '#4C8DFF',
  aksenLatar: 'rgba(76,141,255,0.16)',
};

export const warnaSisi = (s: Sisi) => (s === 'bullish' ? warna.bullish : warna.bearish);
export const latarSisi = (s: Sisi) => (s === 'bullish' ? warna.bullishLatar : warna.bearishLatar);

export const INFO_HORIZON: Record<Horizon, { label: string; ringkas: string; pegangan: string; terang: string }> = {
  harian: {
    label: 'Harian',
    ringkas: 'Day trader',
    pegangan: '1–2 hari',
    terang:
      'Isyarat jangka sangat pendek: momentum 3 hari, lonjakan volum yang disahkan arah harga, posisi harga tutup, gap pembukaan, tembusan julat 5 hari dan lantunan RSI(2). Henti rugi ketat (1× ATR).',
  },
  mingguan: {
    label: 'Mingguan',
    ringkas: 'Swing trader',
    pegangan: '1–3 minggu',
    terang:
      'Isyarat swing: momentum 10 hari, aliran EMA9/EMA21, cerun MACD, RSI(14), tembusan julat 20 hari dan aliran volum. Henti rugi 2× ATR.',
  },
  musiman: {
    label: 'Musiman',
    ringkas: 'Seasonal / position',
    pegangan: '1–3 bulan',
    terang:
      'Isyarat jangka sederhana: corak musim sejarah (prestasi saham bagi bulan yang sama sehingga 10 tahun lalu), momentum 6 bulan, aliran SMA50/SMA200, kekuatan relatif berbanding KLCI dan jarak dari paras tertinggi 52 minggu. Henti rugi 3× ATR.',
  },
};

export const fmtRM = (n: number | null | undefined) => {
  if (n == null || !isFinite(n)) return '—';
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(3);
};

export const fmtPeratus = (n: number | null | undefined, tanda = true) => {
  if (n == null || !isFinite(n)) return '—';
  return `${tanda && n > 0 ? '+' : ''}${n.toFixed(2)}%`;
};

export const fmtJuta = (n: number) => {
  if (!isFinite(n)) return '—';
  if (n >= 1e6) return `RM${(n / 1e6).toFixed(1)}j`;
  if (n >= 1e3) return `RM${(n / 1e3).toFixed(0)}k`;
  return `RM${n.toFixed(0)}`;
};

const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
export const fmtTarikh = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
};

export const fmtMasa = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '—';
  const jam = t.getHours().toString().padStart(2, '0');
  const min = t.getMinutes().toString().padStart(2, '0');
  return `${t.getDate()} ${BULAN[t.getMonth()]} ${jam}:${min}`;
};
