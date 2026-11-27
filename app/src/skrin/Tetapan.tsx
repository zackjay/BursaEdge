import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { jalankanAnalisa, muatData, repoSah } from '../data';
import { DataTerkini, FasaNotifikasi, Horizon, SEMUA_HORIZON, Sisi, Tetapan as T } from '../jenis';
import { Butang, Cip, Kad, Tajuk } from '../komponen';
import { adaVersiBaru, BINA_SEMASA, semakVersi, VERSI_SEMASA } from '../kemaskini';
import { statusLatar } from '../latarBelakang';
import { hantarUjian, kebenaranAda, mintaKebenaran } from '../notifikasi';
import { kiraPemantauan } from '../semak';
import { anggar, kosSebelah, unitUntukModal } from '../kos';
import { ujiPeringatan } from '../peringatan';
import { fmtJam, rekodKuat } from '../peringatanLogik';
import { bacaSemakanTerakhir, bacaToken, KeadaanPeringatan, simpanToken } from '../storan';
import { fmtMasa, INFO_HORIZON, warna } from '../tema';

interface Props {
  tetapan: T;
  data: DataTerkini | null;
  kemaskini: (t: Partial<T>) => void;
  muatSemula: () => void;
  keadaanP: KeadaanPeringatan;
  muatKeadaan: () => void;
}

const LABEL_FASA: Record<FasaNotifikasi, string> = {
  pemantauan: 'Pemantauan (notifikasi ditahan)',
  keputusan: 'Pemantauan selesai — menunggu pilihan anda',
  aktif: 'Aktif — notifikasi setiap penemuan baru',
  senyap: 'Senyap — tiada notifikasi',
};

export default function Tetapan({ tetapan, data, kemaskini, muatSemula, keadaanP, muatKeadaan }: Props) {
  const pr = tetapan.peringatan;
  const kos = tetapan.kos;
  const setPr = (x: Partial<typeof pr>) => kemaskini({ peringatan: { ...pr, ...x } });
  const setKos = (x: Partial<typeof kos>) => kemaskini({ kos: { ...kos, ...x } });
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
      const { data: d } = await muatData(baru, await bacaToken());
      Alert.alert('Berjaya', d ? `Data ${d.tarikh_data} dimuatkan (${d.bilangan_saham_dianalisa} saham).` : 'Sambungan berjaya.');
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

      <Text style={st.label}>Peringatan beli & jual</Text>
      <Kad>
        <View style={st.baris}>
          <View style={{ flex: 1 }}>
            <Text style={st.teks}>Ingatkan masa beli & jual</Text>
            <Text style={st.nota}>
              Beli {fmtJam(pr.masaBeli)} (pasaran dibuka 9:00 pg) · Jual {fmtJam(pr.masaJual)} (dagangan berterusan tamat 4:45 ptg, tutup 5:00 ptg)
            </Text>
          </View>
          <Switch
            value={pr.aktif}
            onValueChange={async (v) => {
              if (v && !(await mintaKebenaran())) {
                setKebenaran(false);
                Alert.alert('Kebenaran diperlukan', 'Benarkan notifikasi untuk BursaEdge dalam tetapan telefon.');
                return;
              }
              setPr({ aktif: v });
            }}
            trackColor={{ true: warna.bullish, false: warna.garis }}
          />
        </View>
        <Text style={[st.nota, { color: warna.teksLemah }]}>
          Seterusnya — Beli: {keadaanP.beliRingkas ?? 'tiada'} · Jual: {keadaanP.jualRingkas ?? 'tiada'}
          {keadaanP.langsungInfo ? `\nHarga langsung terakhir: ${keadaanP.langsungInfo}` : ''}
        </Text>

        <Text style={[st.sub, { marginTop: 12 }]}>Peringatan beli untuk</Text>
        <View style={st.cipBaris}>
          <Cip teks="Semua cadangan BELI" aktif={pr.skop === 'semua'} tekan={() => setPr({ skop: 'semua' })} />
          <Cip teks="Rekod ≥ +1R sahaja" aktif={pr.skop === 'rekod'} tekan={() => setPr({ skop: 'rekod' })} />
          <Cip teks="Pilihan Saya sahaja" aktif={pr.skop === 'pilihan'} tekan={() => setPr({ skop: 'pilihan' })} />
        </View>
        {data ? (
          <Text style={st.nota}>
            Rekod cadangan BELI sekarang:{' '}
            {SEMUA_HORIZON.map((h) => {
              const b = data.horizon?.[h]?.prestasi_cadangan?.beli;
              return `${INFO_HORIZON[h].label} ${b?.n ? `${b.purata_r! > 0 ? '+' : ''}${b.purata_r}R` : '—'}${rekodKuat(data, h) ? ' ⭐' : ''}`;
            }).join(' · ')}
            . "Rekod ≥ +1R" hanya mengingatkan horizon bertanda ⭐.
          </Text>
        ) : null}
        <Text style={st.sub}>Horizon</Text>
        <View style={st.cipBaris}>
          {SEMUA_HORIZON.map((h) => (
            <Cip
              key={h}
              teks={INFO_HORIZON[h].label}
              aktif={pr.horizon.includes(h)}
              tekan={() => {
                const n = togol<Horizon>(pr.horizon, h);
                if (n.length) setPr({ horizon: n });
              }}
            />
          ))}
        </View>
        <Text style={st.sub}>Masa peringatan beli</Text>
        <View style={st.cipBaris}>
          {['08:45', '09:00', '09:15', '09:30'].map((m) => (
            <Cip key={m} teks={fmtJam(m)} aktif={pr.masaBeli === m} tekan={() => setPr({ masaBeli: m })} />
          ))}
        </View>
        <Text style={st.sub}>Masa peringatan jual</Text>
        <View style={st.cipBaris}>
          {['16:00', '16:15', '16:30', '16:40'].map((m) => (
            <Cip key={m} teks={fmtJam(m)} aktif={pr.masaJual === m} tekan={() => setPr({ masaJual: m })} />
          ))}
        </View>
        <Text style={st.sub}>Ingatkan jual apabila untung mencapai</Text>
        <View style={st.cipBaris}>
          {[1, 1.5, 2].map((r) => (
            <Cip key={r} teks={`+${r}R`} aktif={pr.ambangR === r} tekan={() => setPr({ ambangR: r })} />
          ))}
        </View>
        <Text style={st.nota}>
          Peringatan jual juga dihantar pada hari terakhir tempoh pegangan dan apabila henti rugi atau sasaran disentuh. Harga langsung daripada Yahoo lewat ±15 minit.
        </Text>
        <View style={st.baris}>
          <View style={{ flex: 1 }}>
            <Text style={st.teks}>Mod penggera (paling tepat masa)</Text>
            <Text style={st.nota}>Telefon tidak menangguhkan peringatan untuk jimat bateri. Ikon penggera muncul di bar status.</Text>
          </View>
          <Switch value={pr.penggera} onValueChange={(v) => setPr({ penggera: v })} trackColor={{ true: warna.bullish, false: warna.garis }} />
        </View>
        <Butang
          jenis="kedua"
          teks="Uji peringatan (tiba dalam 1 minit)"
          tekan={async () => {
            if (!(await mintaKebenaran())) {
              setKebenaran(false);
              Alert.alert('Kebenaran diperlukan', 'Benarkan notifikasi untuk BursaEdge dalam tetapan telefon.');
              return;
            }
            const jam = await ujiPeringatan(60);
            muatKeadaan();
            Alert.alert('Dijadualkan', `Peringatan ujian akan tiba pada ${jam}. Anda boleh kunci skrin atau tutup app untuk mengujinya.`);
          }}
        />
      </Kad>

      <Text style={st.label}>Modal & kos moomoo</Text>
      <Kad>
        <Text style={st.sub}>Modal bagi setiap dagangan</Text>
        <View style={st.cipBaris}>
          {[1000, 2000, 5000, 10000, 20000, 50000].map((m) => (
            <Cip key={m} teks={`RM${m.toLocaleString('en-MY')}`} aktif={kos.modal === m} tekan={() => setKos({ modal: m })} />
          ))}
        </View>
        <TextInput
          defaultValue={String(kos.modal)}
          keyboardType="number-pad"
          onEndEditing={(e) => {
            const n = Math.round(Number(e.nativeEvent.text.replace(/[^0-9.]/g, '')));
            if (n >= 100) setKos({ modal: n });
          }}
          placeholder="Jumlah lain (RM)"
          placeholderTextColor={warna.teksMalap}
          style={st.input}
        />
        <Text style={st.sub}>Komisen moomoo</Text>
        <View style={st.cipBaris}>
          <Cip teks="0.03% (biasa)" aktif={!kos.komisenPercuma} tekan={() => setKos({ komisenPercuma: false, komisenPeratus: 0.03 })} />
          <Cip teks="RM0 (promosi)" aktif={kos.komisenPercuma} tekan={() => setKos({ komisenPercuma: true })} />
        </View>
        {(() => {
          const s1 = kosSebelah(kos.modal, kos);
          const a = anggar(unitUntukModal(kos.modal, 1), 1, 1, kos);
          return (
            <Text style={st.nota}>
              Bagi pesanan RM{kos.modal.toLocaleString('en-MY')}: komisen RM{s1.komisen.toFixed(2)} + yuran platform RM{s1.platform.toFixed(2)} + yuran penjelasan Bursa 0.03% RM
              {s1.penjelasan.toFixed(2)} + duti setem (RM1 setiap RM1,000) RM{s1.setem.toFixed(2)} = RM{s1.jumlah.toFixed(2)} sehala
              {a ? `, ±RM${a.kos.toFixed(2)} beli + jual (${((a.kos / kos.modal) * 100).toFixed(2)}% daripada modal)` : ''}. REIT dikenakan SST 8% atas komisen & yuran platform. Kadar
              boleh berubah — semak jadual yuran rasmi moomoo.
            </Text>
          );
        })()}
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

      <Text style={st.label}>Versi app</Text>
      <Kad>
        <Text style={st.teks}>
          BursaEdge {VERSI_SEMASA} (bina #{BINA_SEMASA})
        </Text>
        <Text style={st.nota}>Kemas kini dipasang terus di atas versi lama — tetapan, pemantauan & Pilihan Saya kekal.</Text>
        <View style={{ marginTop: 8 }}>
          <Butang
            jenis="kedua"
            teks={sibuk ? 'Menyemak…' : 'Semak versi baru'}
            lumpuh={sibuk}
            tekan={async () => {
              setSibuk(true);
              const v = await semakVersi(tetapan.repo);
              setSibuk(false);
              if (adaVersiBaru(v)) {
                Alert.alert(`Versi ${v.versi} tersedia`, `Bina #${v.bina}. Muat turun sekarang? Selepas muat turun, buka fail APK untuk memasang.`, [
                  { text: 'Nanti', style: 'cancel' },
                  { text: 'Muat turun', onPress: () => Linking.openURL(v.url).catch(() => {}) },
                ]);
              } else {
                Alert.alert('Terkini', v ? 'Anda sudah menggunakan versi terbaru.' : 'Tidak dapat menyemak versi sekarang. Cuba lagi kemudian.');
              }
            }}
          />
        </View>
      </Kad>

      <Text style={st.nota}>
        Enjin {data?.versi_enjin ?? '—'}
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
