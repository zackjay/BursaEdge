import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { repoSah } from '../data';
import { Horizon, SEMUA_HORIZON, Tetapan } from '../jenis';
import { Butang } from '../komponen';
import { mintaKebenaran } from '../notifikasi';
import { INFO_HORIZON, warna } from '../tema';

export default function Mula({ tetapan, selesai }: { tetapan: Tetapan; selesai: (t: Partial<Tetapan>) => void }) {
  const [langkah, setLangkah] = useState(0);
  const [jenis, setJenis] = useState<Horizon>('harian');
  const [tempoh, setTempoh] = useState(20);
  const [repo, setRepo] = useState(tetapan.repo);

  const tamat = async (notif: boolean) => {
    if (notif) await mintaKebenaran();
    selesai({
      sudahMula: true,
      jenisUtama: jenis,
      horizonNotifikasi: [jenis],
      tempohHari: tempoh,
      fasa: tempoh === 0 ? (notif ? 'aktif' : 'senyap') : 'pemantauan',
      mulaTarikh: null,
      repo: repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, ''),
    });
  };

  return (
    <ScrollView contentContainerStyle={st.bekas}>
      <Text style={st.jenama}>
        Bursa<Text style={{ color: warna.bullish }}>Edge</Text>
      </Text>
      <Text style={st.langkah}>Langkah {langkah + 1} / 3</Text>

      {langkah === 0 ? (
        <>
          <Text style={st.soalan}>Anda pedagang jenis apa?</Text>
          <Text style={st.terang}>Analisa dan ranking dibezakan mengikut tempoh pegangan. Anda masih boleh lihat ketiga-tiganya.</Text>
          {SEMUA_HORIZON.map((h) => (
            <Pressable key={h} onPress={() => setJenis(h)} style={[st.pilihan, jenis === h && st.pilihanAktif]}>
              <Text style={st.pilihanTajuk}>
                {INFO_HORIZON[h].label} · {INFO_HORIZON[h].ringkas}
              </Text>
              <Text style={st.pilihanSub}>Pegangan {INFO_HORIZON[h].pegangan}</Text>
              {jenis === h ? <Text style={st.pilihanTerang}>{INFO_HORIZON[h].terang}</Text> : null}
            </Pressable>
          ))}
          <Butang teks="Seterusnya" tekan={() => setLangkah(1)} />
        </>
      ) : null}

      {langkah === 1 ? (
        <>
          <Text style={st.soalan}>Tempoh pemantauan</Text>
          <Text style={st.terang}>
            Enjin akan berjalan setiap hari dagangan di latar belakang dan merekod sama ada ranking Top 10 benar-benar tepat. Selepas
            tempoh ini, anda pilih sama ada mahu notifikasi setiap kali ada penemuan bullish/bearish baru.
          </Text>
          {[
            { n: 10, t: '10 hari dagangan (±2 minggu)' },
            { n: 20, t: '20 hari dagangan (±1 bulan) — disyorkan' },
            { n: 40, t: '40 hari dagangan (±2 bulan)' },
            { n: 0, t: 'Tiada — terus beri notifikasi' },
          ].map((x) => (
            <Pressable key={x.n} onPress={() => setTempoh(x.n)} style={[st.pilihan, tempoh === x.n && st.pilihanAktif]}>
              <Text style={st.pilihanTajuk}>{x.t}</Text>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Butang jenis="kedua" teks="Kembali" tekan={() => setLangkah(0)} />
            </View>
            <View style={{ flex: 2 }}>
              <Butang teks="Seterusnya" tekan={() => setLangkah(2)} />
            </View>
          </View>
        </>
      ) : null}

      {langkah === 2 ? (
        <>
          <Text style={st.soalan}>Sambung ke repo GitHub anda</Text>
          <Text style={st.terang}>Data analisa harian diterbitkan dalam repo BursaEdge anda. Jika app ini dibina oleh GitHub Actions, repo sudah diisi.</Text>
          <TextInput
            value={repo}
            onChangeText={setRepo}
            placeholder="namaanda/BursaEdge"
            placeholderTextColor={warna.teksMalap}
            autoCapitalize="none"
            autoCorrect={false}
            style={st.input}
          />
          {repo && !repoSah(repo.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')) ? (
            <Text style={[st.terang, { color: warna.amaran }]}>Format: pemilik/nama</Text>
          ) : null}
          <Text style={[st.terang, { marginTop: 12 }]}>
            Benarkan notifikasi supaya BursaEdge boleh memaklumkan anda {tempoh ? 'apabila tempoh pemantauan tamat dan seterusnya ' : ''}
            apabila ada penemuan baru.
          </Text>
          <View style={{ gap: 8 }}>
            <Butang teks="Benarkan notifikasi & mula" tekan={() => tamat(true)} />
            <Butang jenis="kedua" teks="Mula tanpa notifikasi" tekan={() => tamat(false)} />
            <Butang jenis="kedua" teks="Kembali" tekan={() => setLangkah(1)} />
          </View>
        </>
      ) : null}

      <Text style={st.penafian}>Analisa teknikal automatik untuk rujukan sahaja. Bukan nasihat pelaburan.</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  bekas: { padding: 20, paddingTop: 32, gap: 10 },
  jenama: { color: warna.teks, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  langkah: { color: warna.teksMalap, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  soalan: { color: warna.teks, fontSize: 22, fontWeight: '800' },
  terang: { color: warna.teksLemah, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  pilihan: { borderWidth: 1, borderColor: warna.garis, borderRadius: 14, padding: 14, backgroundColor: warna.kad },
  pilihanAktif: { borderColor: warna.bullish, backgroundColor: warna.kadTinggi },
  pilihanTajuk: { color: warna.teks, fontSize: 15, fontWeight: '700' },
  pilihanSub: { color: warna.teksLemah, fontSize: 13, marginTop: 2 },
  pilihanTerang: { color: warna.teksLemah, fontSize: 12, lineHeight: 17, marginTop: 8 },
  input: { borderWidth: 1, borderColor: warna.garis, borderRadius: 10, color: warna.teks, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: warna.kad },
  penafian: { color: warna.teksMalap, fontSize: 11, textAlign: 'center', marginTop: 16 },
});
