import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DataTerkini, Horizon, LogPenemuan, Penemuan as P, SEMUA_HORIZON, Tetapan } from '../jenis';
import { Cip, Kad, Kosong, Tajuk } from '../komponen';
import { tapisPenemuan } from '../semak';
import { fmtTarikh, INFO_HORIZON, warna, warnaSisi } from '../tema';

interface Props {
  data: DataTerkini | null;
  log: LogPenemuan[];
  tetapan: Tetapan;
  memuat: boolean;
  muatSemula: () => void;
}

export default function Penemuan({ data, log, tetapan, memuat, muatSemula }: Props) {
  const [tapis, setTapis] = useState<Horizon | 'semua' | 'saya'>('saya');

  const tapisItem = (item: P[]) => {
    if (tapis === 'semua') return item;
    if (tapis === 'saya') return data ? tapisPenemuan(tetapan, { ...data, penemuan_baru: item }) : item;
    return item.filter((p) => p.horizon === tapis);
  };

  const hariIni = data ? tapisItem(data.penemuan_baru ?? []) : [];
  const lepas = useMemo(() => log.filter((l) => !data || l.tarikh !== data.tarikh_data), [log, data]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={memuat} onRefresh={muatSemula} tintColor={warna.teksLemah} colors={[warna.aksen]} />}
    >
      <Tajuk teks="Penemuan baru" kecil="Saham yang baru masuk Top 10 atau naik sekurang-kurangnya 2 anak tangga berbanding hari dagangan sebelumnya." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Cip teks="Pilihan saya" aktif={tapis === 'saya'} tekan={() => setTapis('saya')} />
        <Cip teks="Semua" aktif={tapis === 'semua'} tekan={() => setTapis('semua')} />
        {SEMUA_HORIZON.map((h) => (
          <Cip key={h} teks={INFO_HORIZON[h].label} aktif={tapis === h} tekan={() => setTapis(h)} />
        ))}
      </View>

      <Text style={st.label}>{data ? `Hari ini · ${fmtTarikh(data.tarikh_data)}` : 'Hari ini'}</Text>
      {hariIni.length ? (
        <Kumpulan item={hariIni} />
      ) : (
        <Kosong
          tajuk="Tiada penemuan baru"
          teks={data ? 'Senarai sama seperti hari dagangan sebelumnya bagi tapisan ini.' : 'Data belum dimuatkan.'}
        />
      )}

      {lepas.length ? <Text style={[st.label, { marginTop: 8 }]}>Sebelum ini</Text> : null}
      {lepas.map((l) => {
        const item = tapisItem(l.item);
        if (!item.length) return null;
        return (
          <View key={l.tarikh}>
            <Text style={st.tarikh}>{fmtTarikh(l.tarikh)}</Text>
            <Kumpulan item={item} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function Kumpulan({ item }: { item: P[] }) {
  return (
    <>
      {SEMUA_HORIZON.map((h) => {
        const x = item.filter((p) => p.horizon === h).sort((a, b) => (a.sisi === b.sisi ? a.kedudukan - b.kedudukan : a.sisi === 'bullish' ? -1 : 1));
        if (!x.length) return null;
        return (
          <Kad key={h} gaya={{ paddingVertical: 10 }}>
            <Text style={st.horizon}>{INFO_HORIZON[h].label}</Text>
            {x.map((p) => (
              <View key={`${p.sisi}-${p.ticker}`} style={st.baris}>
                <Text style={[st.sisi, { color: warnaSisi(p.sisi) }]}>{p.sisi === 'bullish' ? '▲' : '▼'}</Text>
                <Text style={[st.rank, { color: warnaSisi(p.sisi) }]}>#{p.kedudukan}</Text>
                <Text style={st.nama}>{p.nama}</Text>
                <Text style={st.kod}>{p.kod}</Text>
                <View style={{ flex: 1 }} />
                <Text style={[st.jenis, p.jenis === 'baru' ? { color: warna.amaran } : { color: warna.aksen }]}>
                  {p.jenis === 'baru' ? 'BARU' : `▲${(p.dari ?? p.kedudukan) - p.kedudukan} dari #${p.dari}`}
                </Text>
              </View>
            ))}
          </Kad>
        );
      })}
    </>
  );
}

const st = StyleSheet.create({
  label: { color: warna.teksLemah, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  tarikh: { color: warna.teksLemah, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  horizon: { color: warna.teks, fontWeight: '800', marginBottom: 4 },
  baris: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 6 },
  sisi: { fontSize: 12, width: 12 },
  rank: { fontWeight: '800', width: 30, fontVariant: ['tabular-nums'] },
  nama: { color: warna.teks, fontWeight: '700' },
  kod: { color: warna.teksMalap, fontSize: 12 },
  jenis: { fontSize: 12, fontWeight: '800' },
});
