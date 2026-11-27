// Semak versi app terbaru di GitHub Releases (fail versi.json yang diterbitkan
// bersama BursaEdge.apk oleh aliran kerja "Bina App Android").
import Constants from 'expo-constants';

export interface InfoVersi {
  versi: string;
  bina: number;
  url: string;
  halaman?: string;
  tarikh?: string;
  saiz_mb?: number;
}

const extra = (Constants.expoConfig?.extra ?? {}) as { bina?: number };
export const VERSI_SEMASA = Constants.expoConfig?.version ?? '—';
export const BINA_SEMASA = Number(extra.bina ?? Constants.expoConfig?.android?.versionCode ?? 0);

export async function semakVersi(repo: string): Promise<InfoVersi | null> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.trim())) return null;
  const ctrl = new AbortController();
  const pemasa = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`https://github.com/${repo.trim()}/releases/download/terkini/versi.json`, {
      signal: ctrl.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const v = (await res.json()) as InfoVersi;
    return v && typeof v.bina === 'number' && v.url ? v : null;
  } catch {
    return null;
  } finally {
    clearTimeout(pemasa);
  }
}

export const adaVersiBaru = (v: InfoVersi | null): v is InfoVersi => !!v && v.bina > BINA_SEMASA;
