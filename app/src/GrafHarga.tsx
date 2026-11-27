// Graf harga ringkas (garisan + kawasan + volum) dengan sentuhan untuk melihat
// harga pada sesuatu titik. Dilukis dengan react-native-svg tanpa pustaka graf.
import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { KunciJulat, SiriHarga } from './jenis';
import { fmtEpoch, fmtHarga, warna } from './tema';

const KANAN = 52; // ruang label harga
const ATAS = 10;
const BAWAH = 20; // ruang label masa

export function labelMasa(julat: KunciJulat, t: number, terperinci = false) {
  if (julat === 'hari') return fmtEpoch(t, 'jam');
  if (julat === 'minggu') return terperinci ? fmtEpoch(t, 'hariJam') : fmtEpoch(t, 'hari');
  if (julat === 'bulan') return fmtEpoch(t, 'hari');
  if (julat === 'tahun') return terperinci ? fmtEpoch(t, 'hari') + ' ' + fmtEpoch(t, 'tahun') : fmtEpoch(t, 'bulanTahun');
  return terperinci ? fmtEpoch(t, 'hari') + ' ' + fmtEpoch(t, 'tahun') : fmtEpoch(t, 'tahun');
}

interface Props {
  siri: SiriHarga;
  julat: KunciJulat;
  tinggi?: number;
  onSentuh?: (i: number | null) => void;
}

export default function GrafHarga({ siri, julat, tinggi = 230, onSentuh }: Props) {
  const [lebar, setLebar] = useState(0);
  const [sentuh, setSentuh] = useState<number | null>(null);
  const n = siri.c.length;
  const naik = siri.c[n - 1] >= siri.rujukan;
  const warnaGaris = naik ? warna.bullish : warna.bearish;
  const adaVolum = !!siri.v && siri.v.some((x) => x > 0);

  const geo = useMemo(() => {
    const lebarPlot = Math.max(10, lebar - KANAN);
    const tinggiPlot = tinggi - ATAS - BAWAH;
    const tinggiHarga = adaVolum ? tinggiPlot * 0.78 : tinggiPlot;
    let min = Math.min(...siri.c);
    let max = Math.max(...siri.c);
    // Sertakan garis rujukan (tutup sebelumnya) jika dekat dengan julat harga
    if (julat === 'hari' || julat === 'minggu') {
      min = Math.min(min, siri.rujukan);
      max = Math.max(max, siri.rujukan);
    }
    if (max - min < 1e-9) {
      max += Math.max(0.005, max * 0.01);
      min -= Math.max(0.005, min * 0.01);
    }
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;
    const langkah = n > 1 ? lebarPlot / (n - 1) : lebarPlot;
    const x = (i: number) => i * langkah;
    const y = (v: number) => ATAS + (1 - (v - min) / (max - min)) * tinggiHarga;
    let garis = '';
    for (let i = 0; i < n; i++) garis += `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(siri.c[i]).toFixed(1)}`;
    const dasar = ATAS + tinggiHarga;
    const kawasan = `${garis}L${x(n - 1).toFixed(1)},${dasar}L0,${dasar}Z`;
    let bar: { x: number; h: number }[] = [];
    if (adaVolum && siri.v) {
      const vmax = Math.max(...siri.v) || 1;
      const ruangVol = tinggiPlot - tinggiHarga - 4;
      bar = siri.v.map((v, i) => ({ x: x(i), h: Math.max(0.5, (v / vmax) * ruangVol) }));
    }
    const tik = [0, 1 / 3, 2 / 3, 1].map((f) => Math.round(f * (n - 1)));
    return { lebarPlot, tinggiPlot, min, max, x, y, garis, kawasan, bar, langkah, tik, dasarPlot: ATAS + tinggiPlot };
  }, [lebar, tinggi, siri, n, julat, adaVolum]);

  const geoRef = useRef(geo);
  geoRef.current = geo;
  const onSentuhRef = useRef(onSentuh);
  onSentuhRef.current = onSentuh;

  const kemaskiniSentuh = (lokasiX: number) => {
    const g = geoRef.current;
    const i = Math.max(0, Math.min(n - 1, Math.round(lokasiX / (g.langkah || 1))));
    setSentuh(i);
    onSentuhRef.current?.(i);
  };
  const lepas = () => {
    setSentuh(null);
    onSentuhRef.current?.(null);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: (e) => kemaskiniSentuh(e.nativeEvent.locationX),
        onPanResponderMove: (e) => kemaskiniSentuh(e.nativeEvent.locationX),
        onPanResponderRelease: lepas,
        onPanResponderTerminate: lepas,
        onPanResponderTerminationRequest: () => true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n]
  );

  const labelY = [geo.max, (geo.max + geo.min) / 2, geo.min];
  const lebarBar = Math.max(1, Math.min(8, geo.langkah * 0.7));

  return (
    <View onLayout={(e: LayoutChangeEvent) => setLebar(e.nativeEvent.layout.width)} style={{ height: tinggi }}>
      {lebar > 0 ? (
        <>
          <Svg width={lebar} height={tinggi}>
            <Defs>
              <LinearGradient id="isi" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={warnaGaris} stopOpacity={0.28} />
                <Stop offset="1" stopColor={warnaGaris} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {labelY.map((_, k) => (
              <Line
                key={k}
                x1={0}
                x2={geo.lebarPlot}
                y1={ATAS + (k / 2) * (geo.y(geo.min) - ATAS)}
                y2={ATAS + (k / 2) * (geo.y(geo.min) - ATAS)}
                stroke={warna.garis}
                strokeWidth={1}
              />
            ))}
            {geo.bar.map((b, i) => (
              <Rect
                key={i}
                x={b.x - lebarBar / 2}
                y={geo.dasarPlot - b.h}
                width={lebarBar}
                height={b.h}
                fill={sentuh === i ? warna.teks : warna.teksMalap}
                opacity={0.45}
              />
            ))}
            <Path d={geo.kawasan} fill="url(#isi)" />
            {julat === 'hari' || julat === 'minggu' ? (
              <Line
                x1={0}
                x2={geo.lebarPlot}
                y1={geo.y(siri.rujukan)}
                y2={geo.y(siri.rujukan)}
                stroke={warna.teksLemah}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            ) : null}
            <Path d={geo.garis} stroke={warnaGaris} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {sentuh != null ? (
              <>
                <Line x1={geo.x(sentuh)} x2={geo.x(sentuh)} y1={ATAS} y2={geo.dasarPlot} stroke={warna.teks} strokeWidth={1} opacity={0.6} />
                <Circle cx={geo.x(sentuh)} cy={geo.y(siri.c[sentuh])} r={4.5} fill={warnaGaris} stroke={warna.latar} strokeWidth={2} />
              </>
            ) : (
              <Circle cx={geo.x(n - 1)} cy={geo.y(siri.c[n - 1])} r={3.5} fill={warnaGaris} />
            )}
          </Svg>
          {/* Label harga di kanan */}
          {labelY.map((v, k) => (
            <Text key={k} style={[st.labelY, { top: ATAS + (k / 2) * (geo.y(geo.min) - ATAS) - 8, left: geo.lebarPlot + 6 }]}>
              {fmtHarga(v)}
            </Text>
          ))}
          {/* Label masa di bawah */}
          {geo.tik.map((i, k) => (
            <Text
              key={k}
              numberOfLines={1}
              style={[
                st.labelX,
                {
                  top: geo.dasarPlot + 4,
                  left: Math.max(0, Math.min(geo.lebarPlot - 60, geo.x(i) - (k === 0 ? 0 : k === 3 ? 60 : 30))),
                  textAlign: k === 0 ? 'left' : k === 3 ? 'right' : 'center',
                },
              ]}
            >
              {labelMasa(julat, siri.t[i])}
            </Text>
          ))}
          {/* Lapisan sentuhan */}
          <View style={[StyleSheet.absoluteFill, { right: KANAN }]} {...pan.panHandlers} />
        </>
      ) : null}
    </View>
  );
}

/** Garis mini (sparkline) untuk senarai saham. */
export function GarisMini({ nilai, lebar = 64, tinggi = 26 }: { nilai: number[]; lebar?: number; tinggi?: number }) {
  if (!nilai || nilai.length < 2) return <View style={{ width: lebar, height: tinggi }} />;
  const min = Math.min(...nilai);
  const max = Math.max(...nilai);
  const julat = max - min || 1;
  const langkah = lebar / (nilai.length - 1);
  let d = '';
  nilai.forEach((v, i) => {
    d += `${i ? 'L' : 'M'}${(i * langkah).toFixed(1)},${(2 + (1 - (v - min) / julat) * (tinggi - 4)).toFixed(1)}`;
  });
  const w = nilai[nilai.length - 1] >= nilai[0] ? warna.bullish : warna.bearish;
  return (
    <Svg width={lebar} height={tinggi}>
      <Path d={d} stroke={w} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

const st = StyleSheet.create({
  labelY: { position: 'absolute', color: warna.teksMalap, fontSize: 10, fontVariant: ['tabular-nums'] },
  labelX: { position: 'absolute', width: 60, color: warna.teksMalap, fontSize: 10 },
});
