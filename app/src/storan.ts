import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { DataTerkini, LogPenemuan, Tetapan } from './jenis';

const K = {
  tetapan: 'be.tetapan.v1',
  cache: 'be.cache.latest.v1',
  dimaklum: 'be.tarikh_dimaklum.v1',
  log: 'be.log_penemuan.v1',
  semakan: 'be.semakan_terakhir.v1',
  keputusanDimaklum: 'be.keputusan_dimaklum.v1',
};
const K_TOKEN = 'bursaedge_github_token';
// Boleh dibaca oleh tugas latar belakang selepas telefon dibuka kunci sekali
const OPSYEN_SS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const extra = (Constants.expoConfig?.extra ?? {}) as { dataRepo?: string; cawangan?: string };

export const TETAPAN_ASAS: Tetapan = {
  sudahMula: false,
  jenisUtama: 'harian',
  horizonNotifikasi: ['harian'],
  sisiNotifikasi: ['bullish', 'bearish'],
  hadKedudukan: 10,
  fasa: 'pemantauan',
  tempohHari: 20,
  mulaTarikh: null,
  maklumSemasaPemantauan: false,
  repo: extra.dataRepo ?? '',
  cawangan: extra.cawangan || 'main',
};

async function bacaJson<T>(kunci: string, lalai: T): Promise<T> {
  try {
    const s = await AsyncStorage.getItem(kunci);
    return s ? (JSON.parse(s) as T) : lalai;
  } catch {
    return lalai;
  }
}

export async function bacaTetapan(): Promise<Tetapan> {
  const t = await bacaJson<Partial<Tetapan>>(K.tetapan, {});
  const gabung = { ...TETAPAN_ASAS, ...t };
  if (!gabung.repo && extra.dataRepo) gabung.repo = extra.dataRepo;
  return gabung;
}

export async function simpanTetapan(t: Tetapan) {
  await AsyncStorage.setItem(K.tetapan, JSON.stringify(t));
}

export const bacaCache = () => bacaJson<DataTerkini | null>(K.cache, null);
export const simpanCache = (d: DataTerkini) => AsyncStorage.setItem(K.cache, JSON.stringify(d));

export const bacaTarikhDimaklum = async () => (await AsyncStorage.getItem(K.dimaklum)) ?? '';
export const simpanTarikhDimaklum = (t: string) => AsyncStorage.setItem(K.dimaklum, t);

export const bacaKeputusanDimaklum = async () => (await AsyncStorage.getItem(K.keputusanDimaklum)) === '1';
export const simpanKeputusanDimaklum = (v: boolean) => AsyncStorage.setItem(K.keputusanDimaklum, v ? '1' : '0');

export const bacaLog = () => bacaJson<LogPenemuan[]>(K.log, []);
export async function tambahLog(entri: LogPenemuan) {
  const log = await bacaLog();
  const lain = log.filter((l) => l.tarikh !== entri.tarikh);
  const baru = [entri, ...lain].sort((a, b) => (a.tarikh < b.tarikh ? 1 : -1)).slice(0, 45);
  await AsyncStorage.setItem(K.log, JSON.stringify(baru));
}

export const bacaSemakanTerakhir = async () => (await AsyncStorage.getItem(K.semakan)) ?? '';
export const simpanSemakanTerakhir = (iso: string) => AsyncStorage.setItem(K.semakan, iso);

export async function bacaToken(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(K_TOKEN, OPSYEN_SS)) ?? '';
  } catch {
    return '';
  }
}

export async function simpanToken(token: string) {
  if (token) await SecureStore.setItemAsync(K_TOKEN, token.trim(), OPSYEN_SS);
  else await SecureStore.deleteItemAsync(K_TOKEN, OPSYEN_SS);
}
