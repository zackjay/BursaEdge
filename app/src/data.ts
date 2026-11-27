import { DataCarta, DataTerkini, Tetapan } from './jenis';

const MASA_TAMAT_MS = 25000;

async function ambil(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const pemasa = setTimeout(() => ctrl.abort(), MASA_TAMAT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(pemasa);
  }
}

export function repoSah(repo: string) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.trim());
}

function urlFail(tetapan: Tetapan, token: string, laluan: string, cawangan: string) {
  const repo = tetapan.repo.trim();
  if (token) {
    return {
      url: `https://api.github.com/repos/${repo}/contents/${laluan}?ref=${encodeURIComponent(cawangan)}`,
      headers: {
        Accept: 'application/vnd.github.raw+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      } as Record<string, string>,
    };
  }
  return {
    url: `https://raw.githubusercontent.com/${repo}/${cawangan}/${laluan}?t=${Date.now()}`,
    headers: { 'Cache-Control': 'no-cache' } as Record<string, string>,
  };
}

export interface HasilMuat {
  data: DataTerkini | null;
  etag: string;
  tidakBerubah: boolean;
}

/** Muat turun data/latest.json daripada repo GitHub.
 *  Repo awam: raw.githubusercontent.com. Repo peribadi: GitHub API dengan token.
 *  Jika `etagLama` diberi dan data tidak berubah, pelayan pulangkan 304 (tiada muat turun). */
export async function muatData(tetapan: Tetapan, token: string, etagLama = ''): Promise<HasilMuat> {
  const repo = tetapan.repo.trim();
  if (!repoSah(repo)) throw new Error('Repo GitHub belum ditetapkan (contoh: namaanda/BursaEdge). Buka Tetapan.');
  const { url, headers } = urlFail(tetapan, token, 'data/latest.json', tetapan.cawangan || 'main');
  if (etagLama) headers['If-None-Match'] = etagLama;
  const res = await ambil(url, { headers });
  if (res.status === 304) return { data: null, etag: etagLama, tidakBerubah: true };
  if (res.status === 404) {
    throw new Error(
      token
        ? 'Data belum ada. Analisa pertama mungkin belum selesai — semak tab Actions di GitHub.'
        : 'Data tidak dijumpai. Jika repo anda private, masukkan token GitHub dalam Tetapan. Jika baru dibina, tunggu analisa pertama selesai.'
    );
  }
  if (res.status === 401 || res.status === 403) throw new Error('Token GitHub ditolak atau tiada akses ke repo ini.');
  if (!res.ok) throw new Error(`Gagal memuat data (HTTP ${res.status}).`);
  const data = (await res.json()) as DataTerkini;
  if (!data || !data.horizon || !data.tarikh_data) throw new Error('Format data tidak dikenali.');
  return { data, etag: res.headers.get('etag') ?? '', tidakBerubah: false };
}

const cacheCarta = new Map<string, DataCarta>();

/** Data graf satu saham daripada cawangan 'carta' (dikemas kini setiap hari oleh enjin). */
export async function muatCarta(tetapan: Tetapan, token: string, kod: string, tarikhData: string, cawangan = 'carta'): Promise<DataCarta> {
  const kunci = `${kod}@${tarikhData}`;
  const ada = cacheCarta.get(kunci);
  if (ada) return ada;
  const { url, headers } = urlFail(tetapan, token, `${encodeURIComponent(kod)}.json`, cawangan);
  const res = await ambil(url, { headers });
  if (res.status === 404) throw new Error('Data graf belum tersedia untuk saham ini. Ia akan muncul selepas analisa seterusnya.');
  if (!res.ok) throw new Error(`Gagal memuat graf (HTTP ${res.status}).`);
  const data = (await res.json()) as DataCarta;
  if (!data?.julat) throw new Error('Format data graf tidak dikenali.');
  if (cacheCarta.size > 40) cacheCarta.clear();
  cacheCarta.set(kunci, data);
  return data;
}

/** Cetuskan aliran kerja analisa di GitHub Actions (perlukan token dengan akses Actions: write). */
export async function jalankanAnalisa(tetapan: Tetapan, token: string): Promise<void> {
  if (!token) throw new Error('Perlukan token GitHub untuk mencetuskan analisa.');
  const res = await ambil(
    `https://api.github.com/repos/${tetapan.repo.trim()}/actions/workflows/analisa-harian.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: tetapan.cawangan || 'main' }),
    }
  );
  if (res.status !== 204) {
    const teks = await res.text().catch(() => '');
    throw new Error(`GitHub menolak permintaan (HTTP ${res.status}). ${teks.slice(0, 140)}`);
  }
}
