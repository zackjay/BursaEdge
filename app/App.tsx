import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DataTerkini, LogPenemuan, Tetapan } from './src/jenis';
import { daftarTugas } from './src/latarBelakang';
import { sediaSaluran } from './src/notifikasi';
import { semakSekarang, tapisPenemuan } from './src/semak';
import Mula from './src/skrin/Mula';
import Penemuan from './src/skrin/Penemuan';
import Prestasi from './src/skrin/Prestasi';
import Ranking from './src/skrin/Ranking';
import TetapanSkrin from './src/skrin/Tetapan';
import { bacaCache, bacaLog, bacaTetapan, simpanKeputusanDimaklum, simpanTetapan } from './src/storan';
import { warna } from './src/tema';

type Tab = 'ranking' | 'penemuan' | 'prestasi' | 'tetapan';
const TAB: { id: Tab; label: string; ikon: string }[] = [
  { id: 'ranking', label: 'Ranking', ikon: '▤' },
  { id: 'penemuan', label: 'Penemuan', ikon: '✦' },
  { id: 'prestasi', label: 'Prestasi', ikon: '◔' },
  { id: 'tetapan', label: 'Tetapan', ikon: '⚙︎' },
];

function Utama() {
  const inset = useSafeAreaInsets();
  const [tetapan, setTetapan] = useState<Tetapan | null>(null);
  const [data, setData] = useState<DataTerkini | null>(null);
  const [log, setLog] = useState<LogPenemuan[]>([]);
  const [ralat, setRalat] = useState<string | undefined>();
  const [memuat, setMemuat] = useState(false);
  const [tab, setTab] = useState<Tab>('ranking');
  const sedangSemak = useRef(false);

  const semak = useCallback(async () => {
    if (sedangSemak.current) return;
    sedangSemak.current = true;
    setMemuat(true);
    try {
      const h = await semakSekarang();
      if (h.data) setData(h.data);
      setTetapan(await bacaTetapan());
      setRalat(h.ralat);
      setLog(await bacaLog());
    } finally {
      sedangSemak.current = false;
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [t, c, l] = await Promise.all([bacaTetapan(), bacaCache(), bacaLog()]);
      setTetapan(t);
      setData(c);
      setLog(l);
      sediaSaluran().catch(() => {});
      daftarTugas().catch(() => {});
      if (t.sudahMula) semak();
    })();
    const langganan = AppState.addEventListener('change', (s) => {
      if (s === 'active') semak();
    });
    const respons = Notifications.addNotificationResponseReceivedListener((r) => {
      const t = r.notification.request.content.data?.tab;
      if (t === 'penemuan' || t === 'ranking' || t === 'prestasi') setTab(t);
    });
    return () => {
      langganan.remove();
      respons.remove();
    };
  }, [semak]);

  const kemaskini = useCallback(
    async (patch: Partial<Tetapan>) => {
      const semasa = tetapan ?? (await bacaTetapan());
      const baru = { ...semasa, ...patch };
      setTetapan(baru);
      await simpanTetapan(baru);
      if (patch.fasa === 'pemantauan') await simpanKeputusanDimaklum(false);
      if (patch.repo !== undefined || patch.cawangan !== undefined) semak();
    },
    [tetapan, semak]
  );

  if (!tetapan) {
    return (
      <View style={[st.akar, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={warna.aksen} />
      </View>
    );
  }

  if (!tetapan.sudahMula) {
    return (
      <View style={[st.akar, { paddingTop: inset.top }]}>
        <Mula
          tetapan={tetapan}
          selesai={async (p) => {
            await kemaskini(p);
            daftarTugas().catch(() => {});
            setTimeout(semak, 50);
          }}
        />
      </View>
    );
  }

  const bilBaru = data ? tapisPenemuan(tetapan, data).length : 0;

  return (
    <View style={[st.akar, { paddingTop: inset.top }]}>
      <View style={{ flex: 1 }}>
        {tab === 'ranking' ? (
          <Ranking
            data={data}
            tetapan={tetapan}
            ralat={ralat}
            memuat={memuat}
            muatSemula={semak}
            kemaskini={kemaskini}
            keTetapan={() => setTab('tetapan')}
          />
        ) : null}
        {tab === 'penemuan' ? <Penemuan data={data} log={log} tetapan={tetapan} memuat={memuat} muatSemula={semak} /> : null}
        {tab === 'prestasi' ? <Prestasi data={data} tetapan={tetapan} memuat={memuat} muatSemula={semak} /> : null}
        {tab === 'tetapan' ? <TetapanSkrin tetapan={tetapan} data={data} kemaskini={kemaskini} muatSemula={semak} /> : null}
      </View>
      <View style={[st.tabBar, { paddingBottom: Math.max(inset.bottom, 8) }]}>
        {TAB.map((t) => {
          const aktif = t.id === tab;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={st.tab} accessibilityRole="tab" accessibilityState={{ selected: aktif }}>
              <View>
                <Text style={[st.tabIkon, aktif && { color: warna.teks }]}>{t.ikon}</Text>
                {t.id === 'penemuan' && bilBaru > 0 ? (
                  <View style={st.lencana}>
                    <Text style={st.lencanaTeks}>{bilBaru > 99 ? '99' : bilBaru}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[st.tabLabel, aktif && { color: warna.teks }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Utama />
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  akar: { flex: 1, backgroundColor: warna.latar },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: warna.garis, backgroundColor: warna.kad, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIkon: { color: warna.teksMalap, fontSize: 18, textAlign: 'center' },
  tabLabel: { color: warna.teksMalap, fontSize: 11, fontWeight: '700' },
  lencana: { position: 'absolute', top: -4, right: -14, backgroundColor: warna.amaran, borderRadius: 8, minWidth: 16, paddingHorizontal: 3, alignItems: 'center' },
  lencanaTeks: { color: '#000', fontSize: 10, fontWeight: '900' },
});
