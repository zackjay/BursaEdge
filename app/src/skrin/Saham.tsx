import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { GarisMini } from '../GrafHarga';
import { DataTerkini, Horizon, PilihanSaya, SahamRingkas, SEMUA_HORIZON, Tetapan } from '../jenis';
import { Cip, Kosong } from '../komponen';
import { fmtHarga, fmtJuta, fmtPeratus, fmtTarikh, INFO_HORIZON, warna } from '../tema';

type Susun = 'nama' | 'hari' | 'bulan' | 'nilai';
const SUSUN: { k: Susun; label: string }[] = [
  { k: 'nama', label: 'A–Z' },
  { k: 'hari', label: '% hari ini' },
  { k: 'bulan', label: '% sebulan' },
  { k: 'nilai', label: 'Paling aktif' },
];
const HURUF: Record<Horizon, string> = { harian: 'H', mingguan: 'M', musiman: 'B' };

interface Props {
  data: DataTerkini | null;
  tetapan: Tetapan;
  memuat: boolean;
  muatSemula: () => void;
  pilihan: PilihanSaya[];
  bukaSaham: (ticker: string, h: Horizon) => void;
}

export default function Saham({ data, tetapan, memuat, muatSemula, pilihan, bukaSaham }: Props) {
  const [cari, setCari] = useState('');
  const [susun, setSusun] = useState<Susun>('nama');
  const [milikSahaja, setMilikSahaja] = useState(false);

  const aktif = useMemo(() => new Set(pilihan.filter((p) => p.status === 'aktif').map((p) => p.ticker)), [pilihan]);

  const senarai = useMemo(() => {
    let s = data?.semua_saham ?? [];
    const q = cari.trim().toLowerCase();
    if (q) s = s.filter((x) => x.nama.toLowerCase().includes(q) || x.kod.toLowerCase().includes(q) || x.sektor.toLowerCase().includes(q));
    if (milikSahaja) s = s.filter((x) => aktif.has(x.ticker));
    const nilai = (x: SahamRingkas) =>
      susun === 'hari' ? x.ubah_peratus ?? -999 : susun === 'bulan' ? x.ubah_21h ?? -999 : susun === 'nilai' ? x.nilai_dagangan_rm ?? 0 : 0;
    return susun === 'nama' ? [...s].sort((a, b) => a.nama.localeCompare(b.nama)) : [...s].sort((a, b) => nilai(b) - nilai(a));
  }, [data, cari, susun, milikSahaja, aktif]);

  return (
    <FlatList
      data={senarai}
      keyExtractor={(x) => x.ticker}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={memuat} onRefresh={muatSemula} tintColor={warna.teksLemah} colors={[warna.aksen]} />}
      initialNumToRender={14}
      ListHeaderComponent={
        <View>
          <Text style={st.jenama}>Saham</Text>
          <Text style={[st.kecil, { marginBottom: 10 }]}>
            {data?.semua_saham ? `${data.semua_saham.length} saham · harga tutup ${fmtTarikh(data.tarikh_data)} · tekan untuk graf` : 'Belum ada data'}
          </Text>
          <TextInput
            value={cari}
            onChangeText={setCari}
            placeholder="Cari nama, kod atau sektor"
            placeholderTextColor={warna.teksMalap}
            autoCapitalize="characters"
            autoCorrect={false}
            style={st.input}
          />
          <View style={st.cipBaris}>
            <Cip teks={`Pilihan saya (${aktif.size})`} aktif={milikSahaja} tekan={() => setMilikSahaja(!milikSahaja)} warnaAktif={warna.bullish} />
            {SUSUN.map((x) => (
              <Cip key={x.k} teks={x.label} aktif={susun === x.k} tekan={() => setSusun(x.k)} />
            ))}
          </View>
          <Text style={[st.kecil, { marginBottom: 8 }]}>Tanda: H = Harian, M = Mingguan, B = Bulanan · ▲ bullish ▼ bearish dengan kedudukan ranking</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Baris s={item} dipilih={aktif.has(item.ticker)} tekan={() => bukaSaham(item.ticker, tetapan.jenisUtama)} />
      )}
      ListEmptyComponent={
        data?.semua_saham ? (
          <Kosong tajuk="Tiada padanan" teks={milikSahaja ? 'Anda belum memilih sebarang saham.' : 'Cuba kata carian lain.'} />
        ) : (
          <Kosong tajuk="Senarai belum tersedia" teks="Senarai saham akan muncul selepas analisa harian seterusnya. Tarik ke bawah untuk muat semula." />
        )
      }
    />
  );
}

function Baris({ s, dipilih, tekan }: { s: SahamRingkas; dipilih: boolean; tekan: () => void }) {
  const ubah = s.ubah_peratus ?? 0;
  const tanda = SEMUA_HORIZON.filter((h) => s.status[h]).map((h) => {
    const x = s.status[h]!;
    return { h, teks: `${HURUF[h]}${x.sisi === 'bullish' ? '▲' : '▼'}${x.kedudukan}`, w: x.sisi === 'bullish' ? warna.bullish : warna.bearish };
  });
  return (
    <Pressable onPress={tekan} style={({ pressed }) => [st.baris, pressed && { backgroundColor: warna.kadTinggi }]} accessibilityRole="button">
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.nama} numberOfLines={1}>
          {dipilih ? <Text style={{ color: warna.bullish }}>● </Text> : null}
          {s.nama} <Text style={st.kod}>{s.kod}</Text>
        </Text>
        <Text style={st.kecil} numberOfLines={1}>
          {s.sektor}
          {s.nilai_dagangan_rm ? ` · ${fmtJuta(s.nilai_dagangan_rm)}/hari` : ''}
        </Text>
        {tanda.length ? (
          <View style={{ flexDirection: 'row', gap: 5, marginTop: 2 }}>
            {tanda.map((t) => (
              <Text key={t.h} style={[st.tanda, { color: t.w, borderColor: t.w }]}>
                {t.teks}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      <GarisMini nilai={s.spark} />
      <View style={{ alignItems: 'flex-end', width: 72 }}>
        <Text style={st.harga}>{fmtHarga(s.harga)}</Text>
        <Text style={[st.ubah, { color: ubah > 0 ? warna.bullish : ubah < 0 ? warna.bearish : warna.teksLemah }]}>{fmtPeratus(s.ubah_peratus)}</Text>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  jenama: { color: warna.teks, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  kecil: { color: warna.teksLemah, fontSize: 12, lineHeight: 17 },
  input: { borderWidth: 1, borderColor: warna.garis, borderRadius: 10, color: warna.teks, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: warna.kad, marginBottom: 10 },
  cipBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: warna.kad, borderWidth: 1, borderColor: warna.garis, marginBottom: 8 },
  nama: { color: warna.teks, fontSize: 15, fontWeight: '700' },
  kod: { color: warna.teksMalap, fontSize: 12, fontWeight: '400' },
  harga: { color: warna.teks, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ubah: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tanda: { fontSize: 10, fontWeight: '800', borderWidth: 1, borderRadius: 5, paddingHorizontal: 4, overflow: 'hidden' },
});
