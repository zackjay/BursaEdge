import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DataHorizon, ItemRanking, Sisi } from './jenis';
import { Kad, LencanaStatus } from './komponen';
import { fmtJuta, fmtPeratus, fmtRM, latarSisi, warna, warnaSisi } from './tema';

export default function ButiranSaham({
  item,
  sisi,
  horizon,
  tutup,
}: {
  item: ItemRanking | null;
  sisi: Sisi;
  horizon: DataHorizon | null;
  tutup: () => void;
}) {
  const inset = useSafeAreaInsets();
  if (!item || !horizon) return null;
  const p = item.paras;
  const risiko = p ? Math.abs(p.masuk - p.henti_rugi) : 0;
  const ganjaran = p ? Math.abs(p.sasaran - p.masuk) : 0;
  const wJumlah = Object.values(horizon.pemberat).reduce((a, b) => a + b, 0) || 1;

  return (
    <Modal visible animationType="slide" onRequestClose={tutup} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: warna.latar, paddingTop: 16 }}>
        <View style={st.kepala}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={st.nama}>{item.nama}</Text>
              <LencanaStatus item={item} />
            </View>
            <Text style={st.sub}>
              {item.kod} · {item.sektor} · {horizon.label}
            </Text>
          </View>
          <Pressable onPress={tutup} hitSlop={12} style={st.tutup} accessibilityLabel="Tutup">
            <Text style={{ color: warna.teks, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: inset.bottom + 24 }}>
          <Kad gaya={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={[st.ranking, { backgroundColor: latarSisi(sisi) }]}>
              <Text style={[st.rankingTeks, { color: warnaSisi(sisi) }]}>#{item.kedudukan}</Text>
              <Text style={[st.rankingSub, { color: warnaSisi(sisi) }]}>{sisi === 'bullish' ? 'Bullish' : 'Bearish'}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.harga}>RM {fmtRM(item.harga)}</Text>
              <Text style={{ color: (item.ubah_peratus ?? 0) >= 0 ? warna.bullish : warna.bearish, fontWeight: '700' }}>
                {fmtPeratus(item.ubah_peratus)} hari ini
              </Text>
              <Text style={st.sub}>
                Skor {Math.round(item.skor)} · Keyakinan {item.keyakinan}%
                {item.kedudukan_sebelum ? ` · semalam #${item.kedudukan_sebelum}` : ''}
              </Text>
            </View>
          </Kad>

          <Text style={st.tajuk}>Kenapa disenaraikan</Text>
          <Kad>
            {item.alasan.length ? (
              item.alasan.map((a, i) => (
                <Text key={i} style={st.alasan}>
                  • {a}
                </Text>
              ))
            ) : (
              <Text style={st.sub}>Gabungan beberapa faktor lemah yang sehala.</Text>
            )}
          </Kad>

          {p ? (
            <>
              <Text style={st.tajuk}>Paras rujukan ({horizon.untuk.split('—')[1]?.trim() ?? horizon.label})</Text>
              <Kad gaya={{ flexDirection: 'row' }}>
                <Paras label="Masuk" nilai={p.masuk} w={warna.teks} />
                <Paras label="Henti rugi" nilai={p.henti_rugi} w={warna.bearish} />
                <Paras label="Sasaran" nilai={p.sasaran} w={warna.bullish} />
              </Kad>
              <Text style={st.nota}>
                Risiko {fmtRM(risiko)} ({((risiko / item.harga) * 100).toFixed(1)}%) · ganjaran {fmtRM(ganjaran)} · nisbah 1:
                {risiko ? (ganjaran / risiko).toFixed(1) : '—'}. Dikira daripada ATR ({item.atr_peratus.toFixed(1)}% sehari). Rujukan
                sahaja.
              </Text>
            </>
          ) : null}

          <Text style={st.tajuk}>Faktor (z-skor berbanding saham lain)</Text>
          <Kad>
            {Object.entries(item.faktor_z ?? {}).map(([k, z]) => (
              <View key={k} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={st.faktor}>{horizon.faktor_label[k] ?? k}</Text>
                  <Text style={st.faktorNilai}>
                    {z > 0 ? '+' : ''}
                    {z.toFixed(2)} · pemberat {Math.round(((horizon.pemberat[k] ?? 0) / wJumlah) * 100)}%
                  </Text>
                </View>
                <BarZ z={z} />
              </View>
            ))}
          </Kad>

          <Kad gaya={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Info label="Nilai dagangan (purata 20 hari)" nilai={fmtJuta(item.nilai_dagangan_rm)} />
            <Info label="Turun naik (ATR)" nilai={`${item.atr_peratus.toFixed(1)}%`} />
          </Kad>
          <Text style={st.nota}>Analisa teknikal automatik untuk rujukan. Bukan nasihat pelaburan — buat keputusan sendiri.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Paras({ label, nilai, w }: { label: string; nilai: number; w: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={st.sub}>{label}</Text>
      <Text style={[st.parasNilai, { color: w }]}>{fmtRM(nilai)}</Text>
    </View>
  );
}

function Info({ label, nilai }: { label: string; nilai: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={st.sub}>{label}</Text>
      <Text style={[st.parasNilai, { fontSize: 15 }]}>{nilai}</Text>
    </View>
  );
}

function BarZ({ z }: { z: number }) {
  const lebar = (Math.min(3, Math.abs(z)) / 3) * 50;
  return (
    <View style={st.barZ}>
      <View style={st.garisTengah} />
      <View
        style={{
          position: 'absolute',
          height: 6,
          borderRadius: 3,
          top: 0,
          width: `${lebar}%`,
          left: z >= 0 ? '50%' : `${50 - lebar}%`,
          backgroundColor: z >= 0 ? warna.bullish : warna.bearish,
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  tutup: { width: 36, height: 36, borderRadius: 18, backgroundColor: warna.kad, alignItems: 'center', justifyContent: 'center' },
  nama: { color: warna.teks, fontSize: 22, fontWeight: '800' },
  sub: { color: warna.teksLemah, fontSize: 13 },
  harga: { color: warna.teks, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ranking: { width: 72, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankingTeks: { fontSize: 24, fontWeight: '900' },
  rankingSub: { fontSize: 11, fontWeight: '700' },
  tajuk: { color: warna.teksLemah, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  alasan: { color: warna.teks, fontSize: 14, lineHeight: 22 },
  parasNilai: { color: warna.teks, fontSize: 18, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  nota: { color: warna.teksMalap, fontSize: 12, lineHeight: 17, marginBottom: 12, marginTop: -4 },
  faktor: { color: warna.teks, fontSize: 13, fontWeight: '600' },
  faktorNilai: { color: warna.teksLemah, fontSize: 12, fontVariant: ['tabular-nums'] },
  barZ: { height: 6, borderRadius: 3, backgroundColor: warna.garis, marginTop: 5, overflow: 'hidden' },
  garisTengah: { position: 'absolute', left: '50%', width: 1, height: 6, backgroundColor: warna.teksMalap },
});
