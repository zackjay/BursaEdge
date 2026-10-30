import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ItemRanking, Sisi } from './jenis';
import { fmtPeratus, fmtRM, latarSisi, warna, warnaSisi } from './tema';

export function Kad({ children, gaya }: { children: React.ReactNode; gaya?: ViewStyle }) {
  return <View style={[s.kad, gaya]}>{children}</View>;
}

export function Tajuk({ teks, kecil }: { teks: string; kecil?: string }) {
  return (
    <View style={{ marginBottom: 8, marginTop: 4 }}>
      <Text style={s.tajuk}>{teks}</Text>
      {kecil ? <Text style={s.tajukKecil}>{kecil}</Text> : null}
    </View>
  );
}

export function Segmen<T extends string>({
  pilihan,
  nilai,
  tukar,
  label,
  sub,
  warnaAktif = warna.aksen,
}: {
  pilihan: T[];
  nilai: T;
  tukar: (v: T) => void;
  label: (v: T) => string;
  sub?: (v: T) => string;
  warnaAktif?: string;
}) {
  return (
    <View style={s.segmen}>
      {pilihan.map((p) => {
        const aktif = p === nilai;
        return (
          <Pressable
            key={p}
            onPress={() => tukar(p)}
            style={[s.segmenItem, aktif && { backgroundColor: warna.kadTinggi, borderColor: warnaAktif }]}
            accessibilityRole="button"
            accessibilityState={{ selected: aktif }}
          >
            <Text style={[s.segmenTeks, aktif && { color: warna.teks }]}>{label(p)}</Text>
            {sub ? <Text style={[s.segmenSub, aktif && { color: warnaAktif }]}>{sub(p)}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Cip({ teks, aktif, tekan, warnaAktif = warna.aksen }: { teks: string; aktif: boolean; tekan: () => void; warnaAktif?: string }) {
  return (
    <Pressable
      onPress={tekan}
      style={[s.cip, aktif && { borderColor: warnaAktif, backgroundColor: warna.kadTinggi }]}
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
    >
      <Text style={[s.cipTeks, aktif && { color: warna.teks }]}>{teks}</Text>
    </Pressable>
  );
}

export function Butang({ teks, tekan, jenis = 'utama', lumpuh }: { teks: string; tekan: () => void; jenis?: 'utama' | 'kedua' | 'bahaya'; lumpuh?: boolean }) {
  const latar = jenis === 'utama' ? warna.aksen : 'transparent';
  const sempadan = jenis === 'bahaya' ? warna.bearish : jenis === 'utama' ? warna.aksen : warna.garis;
  const teksWarna = jenis === 'utama' ? '#fff' : jenis === 'bahaya' ? warna.bearish : warna.teks;
  return (
    <Pressable
      onPress={lumpuh ? undefined : tekan}
      style={({ pressed }) => [s.butang, { backgroundColor: latar, borderColor: sempadan, opacity: lumpuh ? 0.4 : pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
    >
      <Text style={[s.butangTeks, { color: teksWarna }]}>{teks}</Text>
    </Pressable>
  );
}

export function LencanaStatus({ item }: { item: ItemRanking }) {
  let teks = '';
  let w: string = warna.teksLemah;
  let latar = 'transparent';
  if (item.status === 'baru') {
    teks = 'BARU';
    w = warna.amaran;
    latar = warna.amaranLatar;
  } else if (item.status === 'naik' || item.status === 'naik_sedikit') {
    teks = `▲${(item.kedudukan_sebelum ?? item.kedudukan) - item.kedudukan}`;
    w = warna.aksen;
    latar = warna.aksenLatar;
  } else if (item.status === 'turun') {
    teks = `▼${item.kedudukan - (item.kedudukan_sebelum ?? item.kedudukan)}`;
    w = warna.teksMalap;
  } else if (item.status === 'kekal') {
    teks = '•';
    w = warna.teksMalap;
  }
  if (!teks) return null;
  return (
    <View style={[s.lencana, { backgroundColor: latar }]}>
      <Text style={[s.lencanaTeks, { color: w }]}>{teks}</Text>
    </View>
  );
}

export function BarSkor({ nilai, sisi }: { nilai: number; sisi: Sisi }) {
  const lebar = Math.max(4, Math.min(100, nilai));
  return (
    <View style={s.barLatar}>
      <View style={[s.barIsi, { width: `${lebar}%`, backgroundColor: warnaSisi(sisi) }]} />
    </View>
  );
}

export function KadSaham({ item, sisi, tekan }: { item: ItemRanking; sisi: Sisi; tekan: () => void }) {
  const ubah = item.ubah_peratus ?? 0;
  return (
    <Pressable onPress={tekan} style={({ pressed }) => [s.kadSaham, pressed && { backgroundColor: warna.kadTinggi }]} accessibilityRole="button">
      <View style={[s.bulatan, { backgroundColor: latarSisi(sisi) }]}>
        <Text style={[s.bulatanTeks, { color: warnaSisi(sisi) }]}>{item.kedudukan}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={s.baris}>
          <Text style={s.nama} numberOfLines={1}>
            {item.nama}
          </Text>
          <Text style={s.kod}> {item.kod}</Text>
          <LencanaStatus item={item} />
          <View style={{ flex: 1 }} />
          <Text style={s.harga}>{fmtRM(item.harga)}</Text>
        </View>
        <View style={s.baris}>
          <Text style={s.sektor} numberOfLines={1}>
            {item.sektor}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={[s.ubah, { color: ubah > 0 ? warna.bullish : ubah < 0 ? warna.bearish : warna.teksLemah }]}>{fmtPeratus(item.ubah_peratus)}</Text>
        </View>
        <View style={[s.baris, { gap: 8 }]}>
          <View style={{ flex: 1 }}>
            <BarSkor nilai={item.skor} sisi={sisi} />
          </View>
          <Text style={s.skorTeks}>
            Skor {Math.round(item.skor)} · Yakin {item.keyakinan}%
          </Text>
        </View>
        {item.alasan[0] ? (
          <Text style={s.alasan} numberOfLines={2}>
            {item.alasan.slice(0, 2).join(' · ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Kosong({ tajuk, teks, children }: { tajuk: string; teks: string; children?: React.ReactNode }) {
  return (
    <Kad gaya={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
      <Text style={[s.tajuk, { textAlign: 'center' }]}>{tajuk}</Text>
      <Text style={[s.tajukKecil, { textAlign: 'center' }]}>{teks}</Text>
      {children}
    </Kad>
  );
}

export const s = StyleSheet.create({
  kad: { backgroundColor: warna.kad, borderRadius: 14, borderWidth: 1, borderColor: warna.garis, padding: 14, marginBottom: 12 },
  tajuk: { color: warna.teks, fontSize: 16, fontWeight: '700' },
  tajukKecil: { color: warna.teksLemah, fontSize: 13, marginTop: 2, lineHeight: 18 },
  segmen: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  segmenItem: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1, borderColor: warna.garis, alignItems: 'center' },
  segmenTeks: { color: warna.teksLemah, fontWeight: '700', fontSize: 14 },
  segmenSub: { color: warna.teksMalap, fontSize: 11, marginTop: 2 },
  cip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: warna.garis },
  cipTeks: { color: warna.teksLemah, fontSize: 13, fontWeight: '600' },
  butang: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  butangTeks: { fontWeight: '700', fontSize: 14 },
  lencana: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 6 },
  lencanaTeks: { fontSize: 11, fontWeight: '800' },
  barLatar: { height: 5, borderRadius: 3, backgroundColor: warna.garis, overflow: 'hidden' },
  barIsi: { height: 5, borderRadius: 3 },
  kadSaham: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: warna.kad, borderWidth: 1, borderColor: warna.garis, marginBottom: 8 },
  bulatan: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bulatanTeks: { fontWeight: '800', fontSize: 15 },
  baris: { flexDirection: 'row', alignItems: 'center' },
  nama: { color: warna.teks, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  kod: { color: warna.teksMalap, fontSize: 12 },
  harga: { color: warna.teks, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sektor: { color: warna.teksLemah, fontSize: 12, flexShrink: 1 },
  ubah: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  skorTeks: { color: warna.teksLemah, fontSize: 11, fontVariant: ['tabular-nums'] },
  alasan: { color: warna.teksLemah, fontSize: 12, lineHeight: 17 },
});
