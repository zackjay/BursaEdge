import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ButiranSaham from '../ButiranSaham';
import { DataTerkini, Horizon, ItemRanking, SEMUA_HORIZON, Sisi, Tetapan } from '../jenis';
import { Butang, Kad, KadSaham, Kosong, Segmen } from '../komponen';
import { ketepatanSejak, kiraPemantauan } from '../semak';
import { fmtMasa, fmtPeratus, fmtTarikh, INFO_HORIZON, warna } from '../tema';

interface Props {
  data: DataTerkini | null;
  tetapan: Tetapan;
  ralat?: string;
  memuat: boolean;
  muatSemula: () => void;
  kemaskini: (t: Partial<Tetapan>) => void;
  keTetapan: () => void;
}

export default function Ranking({ data, tetapan, ralat, memuat, muatSemula, kemaskini, keTetapan }: Props) {
  const [horizon, setHorizon] = useState<Horizon>(tetapan.jenisUtama);
  const [sisi, setSisi] = useState<Sisi>('bullish');
  const [pilih, setPilih] = useState<ItemRanking | null>(null);

  useEffect(() => setHorizon(tetapan.jenisUtama), [tetapan.jenisUtama]);

  const dh = data?.horizon?.[horizon];
  const senarai = dh ? dh[sisi] : [];

  const kepala = (
    <View>
      <View style={st.atas}>
        <View style={{ flex: 1 }}>
          <Text style={st.jenama}>
            Bursa<Text style={{ color: warna.bullish }}>Edge</Text>
          </Text>
          <Text style={st.kecil}>{data ? `Data ${fmtTarikh(data.tarikh_data)} · ${data.bilangan_saham_dianalisa} saham` : 'Belum ada data'}</Text>
        </View>
        {data?.pasaran?.klci ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={st.klci}>KLCI {data.pasaran.klci.toFixed(2)}</Text>
            <Text style={[st.kecil, { color: (data.pasaran.klci_ubah_peratus ?? 0) >= 0 ? warna.bullish : warna.bearish }]}>
              {fmtPeratus(data.pasaran.klci_ubah_peratus)} · {data.pasaran.rejim}
            </Text>
          </View>
        ) : null}
      </View>

      {data?.sampel ? (
        <Kad gaya={{ borderColor: warna.amaran }}>
          <Text style={{ color: warna.amaran, fontWeight: '700' }}>Data SAMPEL (rawak) — bukan pasaran sebenar.</Text>
        </Kad>
      ) : null}
      {ralat ? (
        <Kad gaya={{ borderColor: warna.bearish }}>
          <Text style={{ color: warna.bearish, fontWeight: '700', marginBottom: 2 }}>Tidak dapat mengemas kini</Text>
          <Text style={st.kecil}>{ralat}</Text>
        </Kad>
      ) : null}

      <PitaPemantauan data={data} tetapan={tetapan} kemaskini={kemaskini} />

      <Segmen
        pilihan={SEMUA_HORIZON}
        nilai={horizon}
        tukar={setHorizon}
        label={(h) => INFO_HORIZON[h].label}
        sub={(h) => INFO_HORIZON[h].ringkas}
      />
      <Text style={[st.kecil, { marginBottom: 10 }]}>
        {INFO_HORIZON[horizon].ringkas} · pegangan {INFO_HORIZON[horizon].pegangan}
        {dh ? ` · ${dh.bilangan_layak} saham layak` : ''}
      </Text>
      <Segmen
        pilihan={['bullish', 'bearish'] as Sisi[]}
        nilai={sisi}
        tukar={setSisi}
        label={(x) => (x === 'bullish' ? '▲ Top 10 Bullish' : '▼ Top 10 Bearish')}
        warnaAktif={sisi === 'bullish' ? warna.bullish : warna.bearish}
      />
    </View>
  );

  return (
    <>
      <FlatList
        data={senarai}
        keyExtractor={(x) => x.ticker}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={kepala}
        renderItem={({ item }) => <KadSaham item={item} sisi={sisi} tekan={() => setPilih(item)} />}
        refreshControl={<RefreshControl refreshing={memuat} onRefresh={muatSemula} tintColor={warna.teksLemah} colors={[warna.aksen]} />}
        ListEmptyComponent={
          !data ? (
            <Kosong
              tajuk={tetapan.repo ? 'Menunggu data pertama' : 'Sambungkan repo GitHub'}
              teks={
                tetapan.repo
                  ? 'Tarik ke bawah untuk muat semula. Analisa berjalan setiap hari bekerja selepas pasaran tutup (~6:20 ptg).'
                  : 'Masukkan nama repo BursaEdge anda (contoh: namaanda/BursaEdge) dalam Tetapan.'
              }
            >
              {!tetapan.repo ? <Butang teks="Buka Tetapan" tekan={keTetapan} /> : null}
            </Kosong>
          ) : (
            <Kosong tajuk="Tiada isyarat" teks={`Tiada saham memenuhi syarat ${sisi} bagi horizon ini hari ini.`} />
          )
        }
        ListFooterComponent={
          data ? (
            <Text style={[st.kecil, { marginTop: 8, textAlign: 'center' }]}>
              Dikemas kini {fmtMasa(data.dijana_pada)} · {data.sumber}
              {'\n'}
              {data.penafian}
            </Text>
          ) : undefined
        }
      />
      <ButiranSaham item={pilih} sisi={sisi} horizon={dh ?? null} tutup={() => setPilih(null)} />
    </>
  );
}

function PitaPemantauan({ data, tetapan, kemaskini }: { data: DataTerkini | null; tetapan: Tetapan; kemaskini: (t: Partial<Tetapan>) => void }) {
  const pm = kiraPemantauan(tetapan, data);
  const k = ketepatanSejak(data, tetapan.mulaTarikh);
  const ringkas = tetapan.horizonNotifikasi
    .map((h) => {
      const n = k[h].bullish.n + k[h].bearish.n;
      const kena = k[h].bullish.kena + k[h].bearish.kena;
      return `${INFO_HORIZON[h].label} ${n ? `${Math.round((100 * kena) / n)}%` : '—'}`;
    })
    .join(' · ');

  if (tetapan.fasa === 'pemantauan') {
    const peratus = pm.tempoh ? (pm.hariKe / pm.tempoh) * 100 : 100;
    return (
      <Kad gaya={{ borderColor: warna.aksen }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={st.pitaTajuk}>Fasa pemantauan</Text>
          <Text style={st.pitaTajuk}>
            Hari {pm.hariKe}/{pm.tempoh}
          </Text>
        </View>
        <View style={st.bar}>
          <View style={[st.barIsi, { width: `${Math.max(3, peratus)}%` }]} />
        </View>
        <Text style={st.kecil}>
          Enjin berjalan setiap hari di latar belakang & merekod ketepatan ranking.{' '}
          {tetapan.maklumSemasaPemantauan ? 'Notifikasi aktif semasa pemantauan.' : 'Notifikasi ditahan sehingga tempoh tamat.'}
        </Text>
        <Text style={[st.kecil, { color: warna.teks, marginTop: 4 }]}>Ketepatan setakat ini: {ringkas}</Text>
      </Kad>
    );
  }
  if (tetapan.fasa === 'keputusan') {
    return (
      <Kad gaya={{ borderColor: warna.bullish }}>
        <Text style={st.pitaTajuk}>Tempoh pemantauan selesai ({pm.tempoh} hari)</Text>
        <Text style={[st.kecil, { marginVertical: 6 }]}>Ketepatan: {ringkas}. Teruskan dengan notifikasi setiap kali ada penemuan bullish/bearish baru dalam Top {tetapan.hadKedudukan}?</Text>
        <View style={{ gap: 8 }}>
          <Butang teks="Ya, teruskan notifikasi" tekan={() => kemaskini({ fasa: 'aktif' })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Butang jenis="kedua" teks="Pantau 10 hari lagi" tekan={() => kemaskini({ fasa: 'pemantauan', tempohHari: tetapan.tempohHari + 10 })} />
            </View>
            <View style={{ flex: 1 }}>
              <Butang jenis="kedua" teks="Senyap" tekan={() => kemaskini({ fasa: 'senyap' })} />
            </View>
          </View>
        </View>
      </Kad>
    );
  }
  return null;
}

const st = StyleSheet.create({
  atas: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  jenama: { color: warna.teks, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  klci: { color: warna.teks, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] },
  kecil: { color: warna.teksLemah, fontSize: 12, lineHeight: 17 },
  pitaTajuk: { color: warna.teks, fontWeight: '800', fontSize: 14 },
  bar: { height: 6, borderRadius: 3, backgroundColor: warna.garis, marginVertical: 8, overflow: 'hidden' },
  barIsi: { height: 6, borderRadius: 3, backgroundColor: warna.aksen },
});
