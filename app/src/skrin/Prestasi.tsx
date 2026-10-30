import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DataTerkini, Horizon, SEMUA_HORIZON, Sisi, StatPrestasi, Tetapan } from '../jenis';
import { Kad, Kosong, Segmen, Tajuk } from '../komponen';
import { ketepatanSejak } from '../semak';
import { fmtPeratus, fmtTarikh, INFO_HORIZON, warna, warnaSisi } from '../tema';

interface Props {
  data: DataTerkini | null;
  tetapan: Tetapan;
  memuat: boolean;
  muatSemula: () => void;
}

export default function Prestasi({ data, tetapan, memuat, muatSemula }: Props) {
  const [h, setH] = useState<Horizon>(tetapan.jenisUtama);
  const dh = data?.horizon?.[h];
  const sejak = ketepatanSejak(data, tetapan.mulaTarikh)[h];
  const pilihan = (data?.pilihan_lepas?.[h] ?? []).slice(0, 15);
  const jumlahW = dh ? Object.values(dh.pemberat).reduce((a, b) => a + b, 0) || 1 : 1;
  const jumlahAsas = dh ? Object.values(dh.pemberat_asas).reduce((a, b) => a + b, 0) || 1 : 1;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={memuat} onRefresh={muatSemula} tintColor={warna.teksLemah} colors={[warna.aksen]} />}
    >
      <Tajuk teks="Prestasi & pembelajaran" kecil="Setiap ranking dinilai selepas tempoh pegangannya tamat. Enjin melaraskan pemberat faktor berdasarkan apa yang benar-benar berkesan." />
      <Segmen pilihan={SEMUA_HORIZON} nilai={h} tukar={setH} label={(x) => INFO_HORIZON[x].label} sub={(x) => `nilai selepas ${data?.horizon?.[x]?.hari_hadapan ?? '—'} hari`} />

      {!dh ? (
        <Kosong tajuk="Belum ada data" teks="Tarik ke bawah untuk muat semula." />
      ) : (
        <>
          <Text style={st.label}>Ketepatan keseluruhan</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <KadStat sisi="bullish" st={dh.prestasi.bullish} />
            <KadStat sisi="bearish" st={dh.prestasi.bearish} />
          </View>

          <Kad>
            <Text style={st.tajukKad}>Sejak pemantauan anda bermula {tetapan.mulaTarikh ? `(${fmtTarikh(tetapan.mulaTarikh)})` : ''}</Text>
            {(['bullish', 'bearish'] as Sisi[]).map((s) => (
              <Text key={s} style={st.teks}>
                <Text style={{ color: warnaSisi(s), fontWeight: '800' }}>{s === 'bullish' ? 'Bullish' : 'Bearish'}: </Text>
                {sejak[s].n ? `${sejak[s].kadar}% tepat (${sejak[s].kena}/${sejak[s].n})` : 'belum cukup tempoh untuk dinilai'}
              </Text>
            ))}
            <Text style={st.nota}>
              "Tepat" = harga bergerak ke arah ramalan selepas {dh.hari_hadapan} hari dagangan. Kadar 50% bersamaan rawak.
            </Text>
          </Kad>

          <Text style={st.label}>Pemberat faktor (belajar {dh.hari_dipelajari} hari)</Text>
          <Kad>
            {Object.keys(dh.pemberat).map((k) => {
              const kini = dh.pemberat[k] / jumlahW;
              const asas = (dh.pemberat_asas[k] ?? 0) / jumlahAsas;
              const beza = kini - asas;
              const ic = dh.ic?.[k];
              return (
                <View key={k} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={st.faktor}>{dh.faktor_label[k] ?? k}</Text>
                    <Text style={[st.nilai, { color: Math.abs(beza) < 0.005 ? warna.teksLemah : beza > 0 ? warna.bullish : warna.bearish }]}>
                      {Math.round(kini * 100)}% {Math.abs(beza) < 0.005 ? '' : beza > 0 ? '▲' : '▼'}
                    </Text>
                  </View>
                  <View style={st.bar}>
                    <View style={[st.barIsi, { width: `${Math.min(100, kini * 250)}%` }]} />
                  </View>
                  {ic != null ? <Text style={st.nota}>IC {ic >= 0 ? '+' : ''}{ic.toFixed(3)} — {ic > 0.02 ? 'berkesan' : ic < -0.02 ? 'songsang, dikurangkan' : 'neutral'}</Text> : null}
                </View>
              );
            })}
            <Text style={st.nota}>IC = korelasi pangkat antara faktor dan pulangan sebenar. Pemberat dihadkan 0.4×–2× nilai asal.</Text>
          </Kad>

          <Text style={st.label}>Ranking terkini yang telah dinilai</Text>
          {pilihan.length ? (
            <Kad gaya={{ paddingVertical: 8 }}>
              {pilihan.map((p, i) => (
                <View key={`${p.tarikh}-${p.sisi}-${p.ticker}-${i}`} style={st.baris}>
                  <Text style={{ color: p.kena ? warna.bullish : warna.bearish, width: 18, fontWeight: '900' }}>{p.kena ? '✓' : '✗'}</Text>
                  <Text style={[st.teksKecil, { width: 64 }]}>{fmtTarikh(p.tarikh).replace(/ \d{4}$/, '')}</Text>
                  <Text style={{ color: warnaSisi(p.sisi), width: 34, fontWeight: '800' }}>
                    {p.sisi === 'bullish' ? '▲' : '▼'}#{p.kedudukan}
                  </Text>
                  <Text style={[st.teks, { flex: 1 }]} numberOfLines={1}>
                    {p.nama}
                  </Text>
                  <Text style={[st.nilai, { color: p.pulangan >= 0 ? warna.bullish : warna.bearish }]}>{fmtPeratus(p.pulangan)}</Text>
                </View>
              ))}
            </Kad>
          ) : (
            <Kosong tajuk="Belum ada penilaian" teks={`Ranking ${INFO_HORIZON[h].label.toLowerCase()} pertama akan dinilai selepas ${dh.hari_hadapan} hari dagangan.`} />
          )}
        </>
      )}
    </ScrollView>
  );
}

function KadStat({ sisi, st: s }: { sisi: Sisi; st: StatPrestasi }) {
  return (
    <Kad gaya={{ flex: 1 }}>
      <Text style={{ color: warnaSisi(sisi), fontWeight: '800', marginBottom: 4 }}>{sisi === 'bullish' ? '▲ Bullish' : '▼ Bearish'}</Text>
      <Text style={st.besar}>{s.kadar_kena != null ? `${s.kadar_kena}%` : '—'}</Text>
      <Text style={st.teksKecil}>tepat · {s.n} pilihan</Text>
      <Text style={[st.teksKecil, { marginTop: 6 }]}>Top 3: {s.kadar_kena_top3 != null ? `${s.kadar_kena_top3}%` : '—'}</Text>
      <Text style={st.teksKecil}>Purata gerak: {fmtPeratus(s.purata_pulangan)}</Text>
      <Text style={st.teksKecil}>vs pasaran: {fmtPeratus(s.purata_lebihan)}</Text>
    </Kad>
  );
}

const st = StyleSheet.create({
  label: { color: warna.teksLemah, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  tajukKad: { color: warna.teks, fontWeight: '800', marginBottom: 6 },
  besar: { color: warna.teks, fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  teks: { color: warna.teks, fontSize: 14, lineHeight: 21 },
  teksKecil: { color: warna.teksLemah, fontSize: 12, lineHeight: 17 },
  nota: { color: warna.teksMalap, fontSize: 11, lineHeight: 16, marginTop: 3 },
  faktor: { color: warna.teks, fontSize: 13, fontWeight: '600' },
  nilai: { color: warna.teks, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bar: { height: 5, borderRadius: 3, backgroundColor: warna.garis, marginTop: 5, overflow: 'hidden' },
  barIsi: { height: 5, borderRadius: 3, backgroundColor: warna.aksen },
  baris: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 6 },
});
