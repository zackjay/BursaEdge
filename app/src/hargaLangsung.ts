// Harga langsung (lewat ±15 minit) terus dari Yahoo Finance untuk saham yang dipantau.
import { HargaLangsung } from './peringatanLogik';
import { bacaLangsung, simpanLangsung } from './storan';

async function satu(ticker: string): Promise<HargaLangsung | null> {
  for (const hos of ['query1', 'query2']) {
    const ctrl = new AbortController();
    const pemasa = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(`https://${hos}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=5m`, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const m = (await res.json())?.chart?.result?.[0]?.meta;
      if (m && typeof m.regularMarketPrice === 'number' && typeof m.regularMarketTime === 'number') {
        return { harga: m.regularMarketPrice, masa: m.regularMarketTime, tinggi: m.regularMarketDayHigh ?? null, rendah: m.regularMarketDayLow ?? null };
      }
    } catch {
      // cuba hos seterusnya
    } finally {
      clearTimeout(pemasa);
    }
  }
  return null;
}

/** Muat harga langsung; guna cache jika diambil kurang `umurMaksMin` minit lalu dan meliputi semua ticker. */
export async function muatHargaLangsung(tickers: string[], umurMaksMin = 8): Promise<Record<string, HargaLangsung>> {
  const unik = [...new Set(tickers)].slice(0, 30);
  if (!unik.length) return {};
  const cache = await bacaLangsung();
  if (Date.now() - cache.diambil < umurMaksMin * 60000 && unik.every((t) => cache.harga[t])) return cache.harga;
  const hasil: Record<string, HargaLangsung> = {};
  for (let i = 0; i < unik.length; i += 5) {
    const kumpulan = unik.slice(i, i + 5);
    const r = await Promise.all(kumpulan.map(satu));
    kumpulan.forEach((t, k) => {
      if (r[k]) hasil[t] = r[k]!;
    });
  }
  if (Object.keys(hasil).length) await simpanLangsung({ diambil: Date.now(), harga: { ...cache.harga, ...hasil } });
  return { ...cache.harga, ...hasil };
}
