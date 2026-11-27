import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { muatCarta } from './data';
import GrafHarga, { labelMasa } from './GrafHarga';
import { DataCarta, DataTerkini, Horizon, KunciJulat, PilihanSaya, SEMUA_HORIZON, Tetapan } from './jenis';
import { Butang, Kad } from './komponen';
import { anggar, fmtRMx, pulangModalPeratus, unitUntukModal } from './kos';
import { cariCadangan, rancangPelan } from './pelan';
import { bacaToken } from './storan';
import { fmtHarga, fmtJuta, fmtPeratus, fmtTarikh, INFO_HORIZON, warna } from './tema';

const JULAT: { k: KunciJulat; label: string }[] = [
  { k: 'hari', label: '1 Hari' },
  { k: 'minggu', label: '1 Minggu' },
  { k: 'bulan', label: '1 Bulan' },
  { k: 'tahun', label: '1 Tahun' },
  { k: 'maks', label: 'Sejak mula' },
];
const JULAT_AWAL: Record<Horizon, KunciJulat> = { harian: 'hari', mingguan: 'bulan', musiman: 'tahun' };

interface Props {
  ticker: string | null;
  horizonAwal: Horizon;
  data: DataTerkini | null;
  tetapan: Tetapan;
  pilihan: PilihanSaya[];
  tambahPilihan: (p: PilihanSaya) => void;
  buangPilihan: (id: string) => void;
  tutup: () => void;
}

export default function ButiranSaham({ ticker, horizonAwal, data, tetapan, pilihan, tambahPilihan, buangPilihan, tutup }: Props) {
  const inset = useSafeAreaInsets();
  const saham = useMemo(() => data?.semua_saham?.find((s) => s.ticker === ticker) ?? null, [data, ticker]);
  const [julat, setJulat] = useState<KunciJulat>(JULAT_AWAL[horizonAwal]);
  const [carta, setCarta] = useState<DataCarta | null>(null);
  const [ralat, setRalat] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [sentuh, setSentuh] = useState<number | null>(null);
  const [hPilih, setHPilih] = useState<Horizon>(horizonAwal);

  useEffect(() => {
    setJulat(JULAT_AWAL[horizonAwal]);
    setHPilih(horizonAwal);
  }, [ticker, horizonAwal]);

  const muat = async () => {
    if (!saham || !data) return;
    setMemuat(true);
    setRalat('');
    try {
      const c = await muatCarta(tetapan, await bacaToken(), saham.kod, data.tarikh_data, data.cawangan_carta || 'carta');
      setCarta(c);
    } catch (e) {
      setRalat((e as Error).message);
    } finally {
      setMemuat(false);
    }
  };

  useEffect(() => {
    setCarta(null);
    if (ticker) muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, data?.tarikh_data]);

  if (!ticker) return null;

  const siri = carta?.julat?.[julat];
  const tersedia = (k: KunciJulat) => !carta || !!carta.julat[k];
  const hargaKini = saham?.harga ?? siri?.c[siri.c.length - 1] ?? null;

  // Paparan harga: titik disentuh atau harga terkini
  let hargaPapar = hargaKini;
  let ubahPapar = saham?.ubah_peratus ?? null;
  let labelPapar = data ? `Tutup ${fmtTarikh(data.tarikh_data)}` : '';
  if (siri && sentuh != null) {
    hargaPapar = siri.c[sentuh];
    ubahPapar = ((siri.c[sentuh] - siri.rujukan) / siri.rujukan) * 100;
    labelPapar = labelMasa(julat, siri.t[sentuh], true);
  } else if (siri && julat !== 'hari') {
    ubahPapar = siri.ubah_peratus;
    labelPapar = `${JULAT.find((j) => j.k === julat)?.label} · hingga ${fmtTarikh(data?.tarikh_data)}`;
  } else if (siri && julat === 'hari') {
    hargaPapar = siri.c[siri.c.length - 1];
    ubahPapar = siri.ubah_peratus;
    labelPapar = `Sesi ${fmtTarikh(siri.tarikh)}`;
  }

  const pelan = saham ? rancangPelan(data, hPilih, saham) : null;
  const sedia = pilihan.find((p) => p.ticker === ticker && p.horizon === hPilih && p.status === 'aktif');
  const statusH = saham?.status?.[hPilih];

  const pilih = () => {
    if (!saham || !pelan || !data) return;
    const simpan = () =>
      tambahPilihan({
        id: `${saham.ticker}-${hPilih}-${Date.now()}`,
        ticker: saham.ticker,
        kod: saham.kod,
        nama: saham.nama,
        horizon: hPilih,
        tarikh: data.tarikh_data,
        harga_masuk: pelan.masuk,
        henti_rugi: pelan.henti,
        sasaran: pelan.sasaran,
        pegangan_hari: pelan.pegangan,
        gred: pelan.gred,
        dari_cadangan: pelan.dariCadangan,
        status: 'aktif',
        harga_semasa: pelan.masuk,
        tarikh_semasa: data.tarikh_data,
      });
    if (statusH?.sisi === 'bearish') {
      Alert.alert(
        'Isyarat bearish',
        `${saham.nama} berada dalam ranking Bearish ${INFO_HORIZON[hPilih].label} (#${statusH.kedudukan}). Teruskan juga?`,
        [{ text: 'Batal', style: 'cancel' }, { text: 'Teruskan', onPress: simpan }]
      );
    } else simpan();
  };

  const dh = data?.horizon?.[hPilih];
  const itemRanking = dh ? [...dh.bullish, ...dh.bearish].find((x) => x.ticker === ticker) : undefined;

  return (
    <Modal visible animationType="slide" onRequestClose={tutup} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: warna.latar, paddingTop: Platform.OS === 'android' ? inset.top + 8 : 12 }}>
        <View style={st.kepala}>
          <View style={{ flex: 1 }}>
            <Text style={st.nama}>{saham?.nama ?? ticker.replace('.KL', '')}</Text>
            <Text style={st.sub}>
              {saham?.kod} · {saham?.sektor}
            </Text>
          </View>
          <Pressable onPress={tutup} hitSlop={12} style={st.tutup} accessibilityLabel="Tutup">
            <Text style={{ color: warna.teks, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: inset.bottom + 28 }}>
          <View style={st.blokHarga}>
            <Text style={st.harga}>RM {fmtHarga(hargaPapar)}</Text>
            <Text style={[st.ubah, { color: (ubahPapar ?? 0) >= 0 ? warna.bullish : warna.bearish }]}>{fmtPeratus(ubahPapar)}</Text>
          </View>
          <Text style={st.sub}>{labelPapar}</Text>

          <View style={st.julatBaris}>
            {JULAT.map((j) => {
              const aktif = j.k === julat;
              const ada = tersedia(j.k);
              return (
                <Pressable
                  key={j.k}
                  onPress={() => ada && setJulat(j.k)}
                  style={[st.julat, aktif && st.julatAktif, !ada && { opacity: 0.35 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: aktif, disabled: !ada }}
                >
                  <Text style={[st.julatTeks, aktif && { color: warna.teks }]}>{j.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={st.kotakGraf}>
            {siri ? (
              <GrafHarga siri={siri} julat={julat} onSentuh={setSentuh} />
            ) : memuat ? (
              <View style={st.tengah}>
                <ActivityIndicator color={warna.aksen} />
              </View>
            ) : (
              <View style={st.tengah}>
                <Text style={[st.sub, { textAlign: 'center', marginBottom: 8 }]}>{ralat || 'Data graf bagi julat ini tidak tersedia.'}</Text>
                {ralat ? <Butang jenis="kedua" teks="Cuba lagi" tekan={muat} /> : null}
              </View>
            )}
          </View>
          {siri ? (
            <Text style={st.nota}>
              Tinggi {fmtHarga(siri.tinggi)} · Rendah {fmtHarga(siri.rendah)}
              {julat === 'hari' || julat === 'minggu' ? ` · garis putus = tutup sebelumnya RM${fmtHarga(siri.rujukan)}` : ''}
              {julat === 'maks' && carta?.mula_data ? ` · data sejak ${fmtTarikh(carta.mula_data)} (rekod terawal yang ada)` : ''}
              {julat === 'tahun' || julat === 'maks' ? ' · dilaraskan untuk dividen & pecahan saham' : ''}
              {'\n'}Sentuh & seret pada graf untuk melihat harga.
            </Text>
          ) : null}

          <Text style={st.tajuk}>Status analisa</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {SEMUA_HORIZON.map((h) => {
              const s = saham?.status?.[h];
              const skor = saham?.skor?.[h];
              const w = s ? (s.sisi === 'bullish' ? warna.bullish : warna.bearish) : warna.teksLemah;
              return (
                <View key={h} style={[st.kadStatus, s && { borderColor: w }]}>
                  <Text style={st.kecil}>{INFO_HORIZON[h].label}</Text>
                  <Text style={[st.statusTeks, { color: w }]}>
                    {s ? `${s.sisi === 'bullish' ? '▲ Bullish' : '▼ Bearish'} #${s.kedudukan}` : 'Neutral'}
                  </Text>
                  <Text style={st.kecil}>{skor != null ? `Skor ${Math.round(skor)}` : 'Tidak layak'}</Text>
                </View>
              );
            })}
          </View>

          {SEMUA_HORIZON.map((h) => {
            const c = cariCadangan(data, h, ticker);
            if (!c) return null;
            const beli = c.tindakan === 'BELI';
            return (
              <Kad key={h} gaya={{ borderColor: beli ? warna.bullish : warna.bearish }}>
                <Text style={[st.cadTajuk, { color: beli ? warna.bullish : warna.bearish }]}>
                  Cadangan {INFO_HORIZON[h].label}: {beli ? 'BELI' : 'ELAK'} · Gred {c.gred}
                </Text>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <Paras label={beli ? 'Zon masuk' : 'Harga'} nilai={beli ? `${fmtHarga(c.zon_masuk[0])}–${fmtHarga(c.zon_masuk[1])}` : fmtHarga(c.harga)} />
                  <Paras label={beli ? 'Henti rugi' : 'Batal jika atas'} nilai={fmtHarga(c.henti_rugi)} sub={`${beli ? '-' : '+'}${c.risiko_peratus}%`} w={warna.bearish} />
                  <Paras label={beli ? 'Sasaran' : 'Sasaran turun'} nilai={fmtHarga(c.sasaran)} sub={`${beli ? '+' : '-'}${c.ganjaran_peratus}%`} w={warna.bullish} />
                </View>
                {c.alasan.length ? <Text style={[st.nota, { marginTop: 8 }]}>{c.alasan.join(' · ')}</Text> : null}
              </Kad>
            );
          })}

          <Text style={st.tajuk}>Pilih untuk dagangan</Text>
          <Kad>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              {SEMUA_HORIZON.map((h) => (
                <Pressable key={h} onPress={() => setHPilih(h)} style={[st.julat, { flex: 1 }, hPilih === h && st.julatAktif]}>
                  <Text style={[st.julatTeks, hPilih === h && { color: warna.teks }]}>{INFO_HORIZON[h].label}</Text>
                </Pressable>
              ))}
            </View>
            {pelan ? (
              <>
                <View style={{ flexDirection: 'row' }}>
                  <Paras label="Masuk" nilai={fmtHarga(pelan.masuk)} />
                  <Paras label="Henti rugi" nilai={fmtHarga(pelan.henti)} sub={`-${(((pelan.masuk - pelan.henti) / pelan.masuk) * 100).toFixed(1)}%`} w={warna.bearish} />
                  <Paras label="Sasaran" nilai={fmtHarga(pelan.sasaran)} sub={`+${(((pelan.sasaran - pelan.masuk) / pelan.masuk) * 100).toFixed(1)}%`} w={warna.bullish} />
                </View>
                <Text style={[st.nota, { marginTop: 8 }]}>
                  {pelan.dariCadangan ? `Daripada cadangan ${INFO_HORIZON[hPilih].label} (gred ${pelan.gred}). ` : 'Dikira daripada turun naik harga (ATR). '}
                  Pegangan maksimum {pelan.pegangan} hari dagangan. Status dikemas kini setiap hari berdasarkan harga tutup.
                </Text>
                {(() => {
                  const reit = saham?.sektor === 'REIT';
                  const unit = unitUntukModal(tetapan.kos.modal, pelan.masuk);
                  const aS = anggar(unit, pelan.masuk, pelan.sasaran, tetapan.kos, reit);
                  const aH = anggar(unit, pelan.masuk, pelan.henti, tetapan.kos, reit);
                  if (!aS || !aH) return <Text style={st.nota}>Modal RM{tetapan.kos.modal} tidak cukup untuk 1 lot (100 unit).</Text>;
                  return (
                    <View style={st.kotakKos}>
                      <Text style={st.kosTajuk}>
                        Anggaran dengan modal RM{tetapan.kos.modal.toLocaleString('en-MY')} · {unit} unit ({aS.lot} lot) = RM{aS.nilaiBeli.toFixed(2)}
                      </Text>
                      <Text style={st.kosBaris}>
                        Jika capai sasaran: <Text style={{ color: warna.bullish, fontWeight: '800' }}>{fmtRMx(aS.bersih)}</Text> bersih ({aS.bersihPeratus > 0 ? '+' : ''}
                        {aS.bersihPeratus}%) · kasar {fmtRMx(aS.kasar)}
                      </Text>
                      <Text style={st.kosBaris}>
                        Jika kena henti rugi: <Text style={{ color: warna.bearish, fontWeight: '800' }}>{fmtRMx(aH.bersih)}</Text> bersih ({aH.bersihPeratus}%) · kasar {fmtRMx(aH.kasar)}
                      </Text>
                      <Text style={st.nota}>
                        Kos moomoo semasa beli RM{aS.kosBeli.jumlah.toFixed(2)}: komisen {aS.kosBeli.komisen.toFixed(2)} + platform {aS.kosBeli.platform.toFixed(2)} + penjelasan{' '}
                        {aS.kosBeli.penjelasan.toFixed(2)} + duti setem {aS.kosBeli.setem.toFixed(2)}
                        {aS.kosBeli.sst ? ` + SST ${aS.kosBeli.sst.toFixed(2)}` : ''}. Semasa jual di sasaran RM{aS.kosJual.jumlah.toFixed(2)}. Pulang modal perlukan kenaikan{' '}
                        {pulangModalPeratus(unit, pelan.masuk, tetapan.kos, reit)}%. Anggaran sahaja — ubah modal & kadar dalam Tetapan.
                      </Text>
                    </View>
                  );
                })()}
                {statusH?.sisi === 'bearish' ? (
                  <Text style={[st.nota, { color: warna.amaran }]}>
                    Amaran: saham ini dalam ranking Bearish {INFO_HORIZON[hPilih].label} #{statusH.kedudukan}.
                  </Text>
                ) : null}
                <View style={{ marginTop: 10 }}>
                  {sedia ? (
                    <Butang jenis="bahaya" teks="Buang daripada Pilihan Saya" tekan={() => buangPilihan(sedia.id)} />
                  ) : (
                    <Butang teks={`Pilih untuk dagangan ${INFO_HORIZON[hPilih].label}`} tekan={pilih} />
                  )}
                </View>
              </>
            ) : (
              <Text style={st.sub}>Data harga tidak mencukupi untuk menyediakan pelan.</Text>
            )}
          </Kad>

          {itemRanking?.faktor_z && dh ? (
            <>
              <Text style={st.tajuk}>Faktor {INFO_HORIZON[hPilih].label} (berbanding saham lain)</Text>
              <Kad>
                {Object.entries(itemRanking.faktor_z).map(([k, z]) => (
                  <View key={k} style={{ marginBottom: 9 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={st.faktor}>{dh.faktor_label[k] ?? k}</Text>
                      <Text style={st.kecil}>
                        {z > 0 ? '+' : ''}
                        {z.toFixed(2)}
                      </Text>
                    </View>
                    <BarZ z={z} />
                  </View>
                ))}
                {itemRanking.alasan.length ? <Text style={st.nota}>{itemRanking.alasan.join(' · ')}</Text> : null}
              </Kad>
            </>
          ) : null}

          {saham ? (
            <Kad gaya={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 }}>
              <Info label="1 minggu" nilai={fmtPeratus(saham.ubah_5h)} w={saham.ubah_5h} />
              <Info label="1 bulan" nilai={fmtPeratus(saham.ubah_21h)} w={saham.ubah_21h} />
              <Info label="1 tahun" nilai={fmtPeratus(saham.ubah_252h)} w={saham.ubah_252h} />
              <Info label="Tinggi 52 mgu" nilai={fmtHarga(saham.tinggi52)} />
              <Info label="Rendah 52 mgu" nilai={fmtHarga(saham.rendah52)} />
              <Info label="Nilai dagangan" nilai={saham.nilai_dagangan_rm ? fmtJuta(saham.nilai_dagangan_rm) : '—'} />
            </Kad>
          ) : null}
          <Text style={st.nota}>Analisa teknikal automatik untuk rujukan. Bukan nasihat pelaburan — buat keputusan sendiri.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Paras({ label, nilai, sub, w = warna.teks }: { label: string; nilai: string; sub?: string; w?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={st.kecil}>{label}</Text>
      <Text style={[st.parasNilai, { color: w }]}>{nilai}</Text>
      {sub ? <Text style={st.kecil}>{sub}</Text> : null}
    </View>
  );
}

function Info({ label, nilai, w }: { label: string; nilai: string; w?: number | null }) {
  const warnaNilai = w == null ? warna.teks : w >= 0 ? warna.bullish : warna.bearish;
  return (
    <View style={{ width: '33.3%' }}>
      <Text style={st.kecil}>{label}</Text>
      <Text style={[st.infoNilai, { color: warnaNilai }]}>{nilai}</Text>
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
  kepala: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  tutup: { width: 36, height: 36, borderRadius: 18, backgroundColor: warna.kad, alignItems: 'center', justifyContent: 'center' },
  nama: { color: warna.teks, fontSize: 22, fontWeight: '800' },
  sub: { color: warna.teksLemah, fontSize: 13 },
  kecil: { color: warna.teksLemah, fontSize: 11 },
  blokHarga: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 },
  harga: { color: warna.teks, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ubah: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  julatBaris: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 8 },
  julat: { flex: 1, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: warna.garis, alignItems: 'center' },
  julatAktif: { borderColor: warna.aksen, backgroundColor: warna.kadTinggi },
  julatTeks: { color: warna.teksLemah, fontSize: 12, fontWeight: '700' },
  kotakGraf: { height: 230, marginBottom: 6 },
  tengah: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  nota: { color: warna.teksMalap, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  tajuk: { color: warna.teksLemah, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginTop: 6 },
  kadStatus: { flex: 1, backgroundColor: warna.kad, borderWidth: 1, borderColor: warna.garis, borderRadius: 12, padding: 10, gap: 3 },
  statusTeks: { fontSize: 13, fontWeight: '800' },
  kotakKos: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: warna.garis },
  kosTajuk: { color: warna.teksLemah, fontSize: 12, marginBottom: 4 },
  kosBaris: { color: warna.teks, fontSize: 13, lineHeight: 20 },
  cadTajuk: { fontSize: 14, fontWeight: '800' },
  parasNilai: { color: warna.teks, fontSize: 16, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  infoNilai: { color: warna.teks, fontSize: 14, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  faktor: { color: warna.teks, fontSize: 13, fontWeight: '600' },
  barZ: { height: 6, borderRadius: 3, backgroundColor: warna.garis, marginTop: 5, overflow: 'hidden' },
  garisTengah: { position: 'absolute', left: '50%', width: 1, height: 6, backgroundColor: warna.teksMalap },
});
