import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import ButiranSaham from './src/ButiranSaham';
import { DataTerkini, Horizon, LogPenemuan, PilihanSaya, Tetapan } from './src/jenis';
import { adaVersiBaru, InfoVersi, semakVersi } from './src/kemaskini';
import { daftarTugas } from './src/latarBelakang';
import { sediaSaluran } from './src/notifikasi';
import { kemaskiniPilihan } from './src/pelan';
import { semakSekarang, tapisPenemuan } from './src/semak';
import CadanganSkrin from './src/skrin/Cadangan';
import Mula from './src/skrin/Mula';
import Penemuan from './src/skrin/Penemuan';
import Prestasi from './src/skrin/Prestasi';
import Ranking from './src/skrin/Ranking';
import SahamSkrin from './src/skrin/Saham';
import TetapanSkrin from './src/skrin/Tetapan';
import { bacaCache, bacaLog, bacaPilihan, bacaTetapan, simpanKeputusanDimaklum, simpanPilihan, simpanTetapan } from './src/storan';
import { warna } from './src/tema';

type Tab = 'cadangan' | 'ranking' | 'saham' | 'penemuan' | 'tetapan';
const TAB: { id: Tab; label: string; ikon: string }[] = [
  { id: 'cadangan', label: 'Cadangan', ikon: '★' },
  { id: 'ranking', label: 'Ranking', ikon: '▤' },
  { id: 'saham', label: 'Saham', ikon: '≋' },
  { id: 'penemuan', label: 'Penemuan', ikon: '✦' },
  { id: 'tetapan', label: 'Tetapan', ikon: '⚙︎' },
];

function Utama() {
  const inset = useSafeAreaInsets();
  const [tetapan, setTetapan] = useState<Tetapan | null>(null);
  const [data, setData] = useState<DataTerkini | null>(null);
  const [log, setLog] = useState<LogPenemuan[]>([]);
  const [ralat, setRalat] = useState<string | undefined>();
  const [memuat, setMemuat] = useState(false);
  const [tab, setTab] = useState<Tab>('cadangan');
  const [pilihan, setPilihan] = useState<PilihanSaya[]>([]);
  const [dibuka, setDibuka] = useState<{ ticker: string; h: Horizon } | null>(null);
  const [prestasiBuka, setPrestasiBuka] = useState(false);
  const [versiBaru, setVersiBaru] = useState<InfoVersi | null>(null);
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
      setPilihan(await bacaPilihan());
    } finally {
      sedangSemak.current = false;
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [t, c, l, p] = await Promise.all([bacaTetapan(), bacaCache(), bacaLog(), bacaPilihan()]);
      setTetapan(t);
      setData(c);
      setLog(l);
      setPilihan(p);
      sediaSaluran().catch(() => {});
      daftarTugas().catch(() => {});
      if (t.sudahMula) semak();
      const v = await semakVersi(t.repo);
      if (adaVersiBaru(v)) setVersiBaru(v);
    })();
    const langganan = AppState.addEventListener('change', (s) => {
      if (s === 'active') semak();
    });
    const respons = Notifications.addNotificationResponseReceivedListener((r) => {
      const t = r.notification.request.content.data?.tab;
      const url = r.notification.request.content.data?.url;
      if (t === 'kemaskini' && typeof url === 'string') Linking.openURL(url).catch(() => {});
      if (t === 'penemuan' || t === 'ranking' || t === 'cadangan' || t === 'saham') setTab(t);
      if (t === 'prestasi') setPrestasiBuka(true);
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

  const tambahPilihan = useCallback(
    async (p: PilihanSaya) => {
      const semasa = await bacaPilihan();
      let baru = [p, ...semasa.filter((x) => !(x.ticker === p.ticker && x.horizon === p.horizon && x.status === 'aktif'))];
      if (data) baru = kemaskiniPilihan(baru, data).senarai;
      setPilihan(baru);
      await simpanPilihan(baru);
    },
    [data]
  );

  const buangPilihan = useCallback(async (id: string) => {
    const baru = (await bacaPilihan()).filter((x) => x.id !== id);
    setPilihan(baru);
    await simpanPilihan(baru);
  }, []);

  const bukaSaham = useCallback((ticker: string, h: Horizon) => setDibuka({ ticker, h }), []);

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
      {versiBaru ? (
        <Pressable onPress={() => Linking.openURL(versiBaru.url).catch(() => {})} style={st.sepanduk} accessibilityRole="button">
          <Text style={st.sepandukTeks}>
            ⬇ Versi baru {versiBaru.versi} tersedia — tekan untuk muat turun & pasang
          </Text>
          <Pressable onPress={() => setVersiBaru(null)} hitSlop={10}>
            <Text style={st.sepandukTeks}>✕</Text>
          </Pressable>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {tab === 'cadangan' ? (
          <CadanganSkrin
            data={data}
            tetapan={tetapan}
            ralat={ralat}
            memuat={memuat}
            muatSemula={semak}
            pilihan={pilihan}
            tambahPilihan={tambahPilihan}
            buangPilihan={buangPilihan}
            bukaSaham={bukaSaham}
            bukaPrestasi={() => setPrestasiBuka(true)}
          />
        ) : null}
        {tab === 'ranking' ? (
          <Ranking
            data={data}
            tetapan={tetapan}
            ralat={ralat}
            memuat={memuat}
            muatSemula={semak}
            kemaskini={kemaskini}
            keTetapan={() => setTab('tetapan')}
            bukaSaham={bukaSaham}
            bukaPrestasi={() => setPrestasiBuka(true)}
          />
        ) : null}
        {tab === 'saham' ? <SahamSkrin data={data} tetapan={tetapan} memuat={memuat} muatSemula={semak} pilihan={pilihan} bukaSaham={bukaSaham} /> : null}
        {tab === 'penemuan' ? <Penemuan data={data} log={log} tetapan={tetapan} memuat={memuat} muatSemula={semak} bukaSaham={bukaSaham} /> : null}
        {tab === 'tetapan' ? <TetapanSkrin tetapan={tetapan} data={data} kemaskini={kemaskini} muatSemula={semak} /> : null}
      </View>
      <ButiranSaham
        ticker={dibuka?.ticker ?? null}
        horizonAwal={dibuka?.h ?? tetapan.jenisUtama}
        data={data}
        tetapan={tetapan}
        pilihan={pilihan}
        tambahPilihan={tambahPilihan}
        buangPilihan={buangPilihan}
        tutup={() => setDibuka(null)}
      />
      <Modal visible={prestasiBuka} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPrestasiBuka(false)}>
        <View style={{ flex: 1, backgroundColor: warna.latar, paddingTop: 12 }}>
          <View style={st.modalKepala}>
            <Pressable onPress={() => setPrestasiBuka(false)} hitSlop={12} style={st.tutup} accessibilityLabel="Tutup">
              <Text style={{ color: warna.teks, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <Prestasi data={data} tetapan={tetapan} memuat={memuat} muatSemula={semak} />
        </View>
      </Modal>
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
  sepanduk: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: warna.aksen, paddingHorizontal: 14, paddingVertical: 10 },
  sepandukTeks: { color: '#fff', fontWeight: '800', fontSize: 13, flexShrink: 1 },
  modalKepala: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
  tutup: { width: 36, height: 36, borderRadius: 18, backgroundColor: warna.kad, alignItems: 'center', justifyContent: 'center' },
});
