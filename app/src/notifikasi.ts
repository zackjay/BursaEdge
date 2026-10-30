import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Horizon, Penemuan } from './jenis';
import { INFO_HORIZON } from './tema';

export const SALURAN_PENEMUAN = 'penemuan';
export const SALURAN_SISTEM = 'sistem';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function sediaSaluran() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SALURAN_PENEMUAN, {
    name: 'Penemuan baru (bullish/bearish)',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#22C55E',
  });
  await Notifications.setNotificationChannelAsync(SALURAN_SISTEM, {
    name: 'Status pemantauan',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function kebenaranAda(): Promise<boolean> {
  const s = await Notifications.getPermissionsAsync();
  return s.granted || s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function mintaKebenaran(): Promise<boolean> {
  await sediaSaluran();
  if (await kebenaranAda()) return true;
  const s = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return s.granted;
}

async function papar(tajuk: string, badan: string, data: Record<string, unknown>, saluran: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title: tajuk, body: badan, data, sound: true },
    trigger: Platform.OS === 'android' ? { channelId: saluran } : null,
  });
}

export function susunMesej(item: Penemuan[]) {
  const ikut: Partial<Record<Horizon, Penemuan[]>> = {};
  item.forEach((p) => (ikut[p.horizon] = [...(ikut[p.horizon] ?? []), p]));
  const mesej: { horizon: Horizon; tajuk: string; badan: string }[] = [];
  (['harian', 'mingguan', 'musiman'] as Horizon[]).forEach((h) => {
    const s = ikut[h];
    if (!s?.length) return;
    const baris: string[] = [];
    (['bullish', 'bearish'] as const).forEach((sisi) => {
      const x = s.filter((p) => p.sisi === sisi).sort((a, b) => a.kedudukan - b.kedudukan);
      if (!x.length) return;
      const teks = x
        .map((p) => `#${p.kedudukan} ${p.nama}${p.jenis === 'baru' ? ' (baru)' : ` (▲${(p.dari ?? p.kedudukan) - p.kedudukan})`}`)
        .join(', ');
      baris.push(`${sisi === 'bullish' ? '🟢 Bullish' : '🔴 Bearish'}: ${teks}`);
    });
    mesej.push({
      horizon: h,
      tajuk: `BursaEdge ${INFO_HORIZON[h].label} · ${s.length} penemuan baru`,
      badan: baris.join('\n'),
    });
  });
  return mesej;
}

export async function hantarPenemuan(item: Penemuan[], tarikh: string) {
  if (!(await kebenaranAda())) return 0;
  const mesej = susunMesej(item);
  for (const m of mesej) {
    await papar(m.tajuk, m.badan, { tab: 'penemuan', horizon: m.horizon, tarikh }, SALURAN_PENEMUAN);
  }
  return mesej.length;
}

export async function hantarSistem(tajuk: string, badan: string, tab = 'ranking') {
  if (!(await kebenaranAda())) return;
  await papar(tajuk, badan, { tab }, SALURAN_SISTEM);
}

export async function hantarUjian() {
  const ok = await mintaKebenaran();
  if (!ok) return false;
  await papar(
    'BursaEdge Harian · contoh notifikasi',
    '🟢 Bullish: #1 CONTOH (baru), #4 SAHAM (▲3)\n🔴 Bearish: #2 UJIAN (baru)',
    { tab: 'penemuan' },
    SALURAN_PENEMUAN
  );
  return true;
}
