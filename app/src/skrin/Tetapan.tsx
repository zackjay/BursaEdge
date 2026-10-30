import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { jalankanAnalisa, muatData, repoSah } from '../data';
import { DataTerkini, FasaNotifikasi, Horizon, SEMUA_HORIZON, Sisi, Tetapan as T } from '../jenis';
import { Butang, Cip, Kad, Tajuk } from '../komponen';
import { statusLatar } from '../latarBelakang';
import { hantarUjian, kebenaranAda, mintaKebenaran } from '../notifikasi';
import { kiraPemantauan } from '../semak';
import { bacaSemakanTerakhir, bacaToken, simpanToken } from '../storan';
import { fmtMasa, INFO_HORIZON, warna } from '../tema';

interface Props {
  tetapan: T;
  data: DataTerkini | null;
  kemaskini: (t: Partial<T>) => void;
  muatSemula: () => void;
}

const LABEL_FASA: Record<FasaNotifikasi, string> = {
  pemantauan: 'Pemantauan (notifikasi ditahan)',
  keputusan: 'Pemantauan selesai — menunggu pilihan anda',
  aktif: 'Aktif — notifikasi setiap penemuan baru',
  senyap: 'Senyap — tiada notifikasi',
};

export default function Tetapan({ tetapan, data, kemaskini, muatSemula }: Props) {
  const [repo, setRepo] = useState(tetapan.repo);
  const [cawangan, setCawangan] = useState(tetapan.cawangan);
  const [token, setToken] = useState('');
  const [adaToken, setAdaToken] = useState(false);
  const [semakan, setSemakan] = useState('');
  const [latar, setLatar] = useState<{ tersedia: boolean; berdaftar: boolean } | null>(null);
  const [kebenaran, setKebenaran] = useState<boolean | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    bacaToken().then((t) => setAdaToken(!!t));
    bacaSemakanTerakhir().then(setSemakan);
    statusLatar().then(setLatar).catch(() => setLatar(null));
    kebenaranAda().then(setKebenaran);
  }, []);

  const togol = <X,>(senarai: X[], x: X) => (senarai.includes(x) ? senarai.filter((y) => y !== x) : [...senarai, x]);
  const pm = kiraPemantauan(tetapan, data);
  const notifAktif = tetapan.fasa === 'aktif';

  const hidupkanNotif = async (v: boolean) => {
    if (v) {
      const ok = await mintaKebenaran();
      setKebenaran(ok);
      if (!ok) {
        Alert.alert('Kebenaran diperlukan', 'Benarkan notifikasi untuk BursaEdge dalam tetapan telefon anda.');
        return;
      }
      kemaskini({ fasa: 'aktif' });
    } else {
      kemaskini({ fasa: 'senyap' });
    }
  };

  const simpanSumber = async () => {
    const r = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    if (!repoSah(r)) {
      Alert.alert('Format repo', 'Gunakan format pemilik/nama, contoh: namaanda/BursaEdge');
      return;
    }
    setSibuk(true);
    try {
      if (token) {
        await simpanToken(token);
        setAdaToken(true);
        setToken('');
      }
      const baru = { ...tetapan, repo: r, cawangan: cawangan.trim() || 'main' };
      kemaskini({ repo: r, cawangan: baru.cawangan });
      const d = await muatData(baru, await bacaToken());
      Alert.alert('Berjaya', `Data ${d.tarikh_data} dimuatkan (${d.bilangan_saham_dianalisa} saham).`);
      muatSemula();
    } catch (e) {
      Alert.alert('Sambungan gagal', (e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  const cetuskan = async () => {
    setSibuk(true);
    try {
      await jalankanAnalisa(tetapan, await bacaToken());
      Alert.alert('Dicetuskan', 'Analisa sedang berjalan di GitHub (±3–6 minit). Tarik ke bawah di skrin Ranking selepas itu.');
    } catch (e) {
      Alert.alert('Gagal', (e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Tajuk teks="Tetapan" />

      <Text style={st.label}>Jenis pedagang utama</Text>
      <Kad>
        {SEMUA_HORIZON.map((h) => (
          <View key={h} style={{ marginBottom: 8 }}>
            <Cip
              teks={`${INFO_HORIZON[h].label} — ${INFO_HORIZON[h].ringkas} (${INFO_HORIZON[h].pegangan})`}
              aktif={tetapan.jenisUtama === h}
              tekan={() => kemaskini({ jenisUtama: h })}
            />
          </View>
        ))}
        <Text style={st.nota}>{INFO_HORIZON[tetapan.jenisUtama].terang}</Text>
      </Kad>

      <Text style={st.label}>Notifikasi penemuan baru</Text>
      <Kad>
        <View style={st.baris}>
          <View style={{ flex: 1 }}>
            <Text style={st.teks}>Hantar notifikasi</Text>
            <Text style={st.nota}>{LABEL_FASA[tetapan.fasa]}</Text>
          </View>
          <Switch value={notifAktif} onValueChange={hidupkanNotif} trackColor={{ true: warna.bullish, false: warna.garis }} />
        </View>
        {kebenaran === false ? <Text style={[st.nota, { color: warna.amaran }]}>Kebenaran notifikasi telefon belum diberi.</Text> : null}

        <Text style={[st.sub, { marginTop: 12 }]}>Horizon yang dimaklumkan</Text>
        <View style={st.cipBaris}>
          {SEMUA_HORIZON.map((h) => (
            <Cip
              key={h}
              teks={INFO_HORIZON[h].label}
              aktif={tetapan.horizonNotifikasi.includes(h)}
              tekan={() => {
                const n = togol<Horizon>(tetapan.horizonNotifikasi, h);
                if (n.length) kemaskini({ horizonNotifikasi: n });
              }}
            />
          ))}
        </View>
        <Text style={st.sub}>Arah</Text>
        <View style={st.cipBaris}>
          {(['bullish', 'bearish'] as Sisi[]).map((s) => (
            <Cip
              key={s}
              teks={s === 'bullish' ? '▲ Bullish' : '▼ Bearish'}
              warnaAktif={s === 'bullish' ? warna.bullish : warna.bearish}
              aktif={tetapan.sisiNotifikasi.includes(s)}
              tekan={() => {
                const n = togol<Sisi>(tetapan.sisiNotifikasi, s);
                if (n.length) kemaskini({ sisiNotifikasi: n });
              }}
            />
          ))}
        </View>
        <Text style={st.sub}>Maklumkan jika masuk</Text>
        <View style={st.cipBaris}>
          {[3, 5, 10].map((n) => (
            <Cip key={n} teks={`Top ${n}`} aktif={tetapan.hadKedudukan === n} tekan={() => kemaskini({ hadKedudukan: n })} />
          ))}
        </View>
        <Butang
          jenis="kedua"
          teks="Hantar notifikasi ujian"
          tekan={async () => {
            const ok = await hantarUjian();
            setKebenaran(ok);
            if (!ok) Alert.alert('Kebenaran diperlukan', 'Benarkan notifikasi untuk BursaEdge dalam tetapan telefon.');
          }}
        />
      </Kad>

      <Text style={st.label}>Tempoh pemantauan</Text>
      <Kad>
        <Text style={st.teks}>
          {tetapan.fasa === 'pemantauan' ? `Hari ${pm.hariKe} daripada ${pm.tempoh} hari dagangan` : `Tempoh ${tetapan.tempohHari} hari dagangan`}
        </Text>
        <Text style={st.nota}>
          Enjin dijalankan setiap hari dan ketepatannya direkod. Selepas tempoh ini tamat, anda boleh pilih sama ada mahu teruskan notifikasi.
        </Text>
        <View style={st.cipBaris}>
          {[5, 10, 20, 40, 60].map((n) => (
            <Cip key={n} teks={`${n} hari`} aktif={tetapan.tempohHari === n} tekan={() => kemaskini({ tempohHari: n })} />
          ))}
        </View>
        <View style={st.baris}>
          <View style={{ flex: 1 }}>
            <Text style={st.teks}>Maklum juga semasa pemantauan</Text>
            <Text style={st.nota}>Terima notifikasi sebelum tempoh tamat.</Text>
          </View>
          <Switch
            value={tetapan.maklumSemasaPemantauan}
            onValueChange={async (v) => {
              if (v && !(await mintaKebenaran())) return;
              kemaskini({ maklumSemasaPemantauan: v });
            }}
            trackColor={{ true: warna.bullish, false: warna.garis }}
          />
        </View>
        <Butang
          jenis="kedua"
          teks="Mula semula pemantauan dari hari ini"
          tekan={() =>
            Alert.alert('Mula semula?', 'Kiraan hari dan ketepatan pemantauan akan bermula semula.', [
              { text: 'Batal', style: 'cancel' },
              { text: 'Mula semula', onPress: () => kemaskini({ fasa: 'pemantauan', mulaTarikh: data?.tarikh_data ?? null }) },
            ])
          }
        />
      </Kad>

      <Text style={st.label}>Semakan latar belakang</Text>
      <Kad>
        <Text style={st.teks}>
          {latar == null ? 'Menyemak…' : latar.tersedia ? (latar.berdaftar ? 'Aktif — telefon menyemak data baru secara berkala' : 'Tersedia tetapi belum didaftar') : 'Tidak tersedia pada peranti ini'}
        </Text>
        <Text style={st.nota}>Semakan terakhir: {fmtMasa(semakan)}</Text>
        <Text style={st.nota}>
          {Platform.OS === 'ios'
            ? 'iOS menentukan sendiri masa semakan latar belakang (boleh lewat beberapa jam). Untuk push segera di iPhone, aktifkan ntfy atau Telegram dalam repo GitHub (lihat README).'
            : 'Android menyemak lebih kurang setiap jam. Jika notifikasi lewat, matikan "pengoptimuman bateri" untuk BursaEdge.'}
        </Text>
      </Kad>

      <Text style={st.label}>Sumber data (GitHub)</Text>
      <Kad>
        <Text style={st.sub}>Repo</Text>
        <TextInput
          value={repo}
          onChangeText={setRepo}
          placeholder="namaanda/BursaEdge"
          placeholderTextColor={warna.teksMalap}
          autoCapitalize="none"
          autoCorrect={false}
          style={st.input}
        />
        <Text style={st.sub}>Cawangan</Text>
        <TextInput value={cawangan} onChangeText={setCawangan} autoCapitalize="none" autoCorrect={false} style={st.input} />
        <Text style={st.sub}>Token GitHub (pilihan)</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder={adaToken ? '•••••••• (disimpan) — taip untuk tukar' : 'Untuk repo private / butang Jalankan analisa'}
          placeholderTextColor={warna.teksMalap}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={st.input}
        />
        <Text style={st.nota}>Token disimpan dalam storan selamat telefon. Fine-grained token: Contents (Read) + Actions (Read & write) untuk repo ini sahaja.</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          <Butang teks={sibuk ? 'Sila tunggu…' : 'Simpan & uji sambungan'} tekan={simpanSumber} lumpuh={sibuk} />
          {adaToken ? <Butang jenis="kedua" teks="Jalankan analisa sekarang" tekan={cetuskan} lumpuh={sibuk} /> : null}
          {adaToken ? (
            <Butang
              jenis="bahaya"
              teks="Padam token"
              tekan={async () => {
                await simpanToken('');
                setAdaToken(false);
              }}
            />
          ) : null}
        </View>
      </Kad>

      <Text style={st.nota}>
        BursaEdge v{Constants.expoConfig?.version ?? '—'} · enjin {data?.versi_enjin ?? '—'}
        {data?.ticker_gagal?.length ? ` · ${data.ticker_gagal.length} kod gagal dimuat: ${data.ticker_gagal.slice(0, 8).join(', ')}` : ''}
        {'\n'}Analisa teknikal automatik untuk rujukan sahaja. Bukan nasihat pelaburan.
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  label: { color: warna.teksLemah, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  teks: { color: warna.teks, fontSize: 15, fontWeight: '600' },
  sub: { color: warna.teksLemah, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  nota: { color: warna.teksMalap, fontSize: 12, lineHeight: 17, marginTop: 4 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  cipBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: warna.garis, borderRadius: 10, color: warna.teks, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: warna.latar },
});
