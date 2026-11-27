import React, { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DataTerkini, Horizon, PelanCadangan, PilihanSaya, SEMUA_HORIZON, Tetapan, TetapanKos } from '../jenis';
import { Kad, Kosong, Segmen } from '../komponen';
import { anggar, fmtRMx, unitUntukModal } from '../kos';
import { kebenaranAda } from '../notifikasi';
import { hariDipegang, LABEL_STATUS, untungPeratus } from '../pelan';
import { fmtJam, minitMYT, tarikhMYT } from '../peringatanLogik';
import { CacheLangsung, KeadaanPeringatan } from '../storan';
import { fmtHarga, fmtPeratus, fmtTarikh, INFO_HORIZON, warna } from '../tema';

interface Props {
  data: DataTerkini | null;
  tetapan: Tetapan;
  ralat?: string;
  memuat: boolean;
  muatSemula: () => void;
  pilihan: PilihanSaya[];
  tambahPilihan: (p: PilihanSaya) => void;
  buangPilihan: (id: string) => void;
  bukaSaham: (ticker: string, h: Horizon) => void;
  bukaPrestasi: () => void;
  langsung: CacheLangsung['harga'];
  keadaanP: KeadaanPeringatan;
  keTetapan: () => void;
}

const WARNA_GRED: Record<string, string> = { A: warna.bullish, B: warna.aksen, C: warna.teksLemah };

export default function Cadangan({ data, tetapan, ralat, memuat, muatSemula, pilihan, tambahPilihan, buangPilihan, bukaSaham, bukaPrestasi, langsung, keadaanP, keTetapan }: Props) {
  const [h, setH] = useState<Horizon>(tetapan.jenisUtama);
  const [izin, setIzin] = useState(true);
  useEffect(() => {
    kebenaranAda().then(setIzin);
  }, [keadaanP]);
  const kos = tetapan.kos;
  useEffect(() => setH(tetapan.jenisUtama), [tetapan.jenisUtama]);

  const dh = data?.horizon?.[h];
  const cad = dh?.cadangan;
  const pc = dh?.prestasi_cadangan;
  const milikH = pilihan.filter((p) => p.horizon === h).sort((a, b) => (a.status === 'aktif' ? -1 : 1) - (b.status === 'aktif' ? -1 : 1) || (a.tarikh < b.tarikh ? 1 : -1));
  const lepas = (data?.cadangan_lepas?.[h] ?? []).slice(0, 8);

  const pilih = (c: PelanCadangan) => {
    if (!data || !cad) return;
    tambahPilihan({
      id: `${c.ticker}-${h}-${Date.now()}`,
      ticker: c.ticker,
      kod: c.kod,
      nama: c.nama,
      horizon: h,
      tarikh: data.tarikh_data,
      harga_masuk: c.harga,
      henti_rugi: c.henti_rugi,
      sasaran: c.sasaran,
      pegangan_hari: cad.pegangan_hari,
      gred: c.gred,
      dari_cadangan: true,
      status: 'aktif',
      harga_semasa: c.harga,
      tarikh_semasa: data.tarikh_data,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={memuat} onRefresh={muatSemula} tintColor={warna.teksLemah} colors={[warna.aksen]} />}
    >
      <View style={st.atas}>
        <View style={{ flex: 1 }}>
          <Text style={st.jenama}>Cadangan</Text>
          <Text style={st.kecil}>{data ? `Berdasarkan harga tutup ${fmtTarikh(data.tarikh_data)}` : 'Belum ada data'}</Text>
        </View>
        {data?.pasaran?.klci ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={st.klci}>KLCI {data.pasaran.klci.toFixed(2)}</Text>
            <Text style={[st.kecil, { color: data.pasaran.rejim === 'menurun' ? warna.bearish : data.pasaran.rejim === 'menaik' ? warna.bullish : warna.teksLemah }]}>
              Aliran {data.pasaran.rejim}
            </Text>
          </View>
        ) : null}
      </View>

      {ralat ? (
        <Kad gaya={{ borderColor: warna.bearish }}>
          <Text style={{ color: warna.bearish, fontWeight: '700', marginBottom: 2 }}>Tidak dapat mengemas kini</Text>
          <Text style={st.kecil}>{ralat}</Text>
        </Kad>
      ) : null}

      <Pressable onPress={keTetapan} style={st.pitaP}>
        {!tetapan.peringatan.aktif ? (
          <Text style={st.pitaPTeks}>🔕 Peringatan beli & jual dimatikan — tekan untuk hidupkan</Text>
        ) : !izin ? (
          <Text style={[st.pitaPTeks, { color: warna.amaran }]}>🔔 Benarkan notifikasi dalam Tetapan supaya peringatan beli & jual boleh dihantar</Text>
        ) : (
          <Text style={st.pitaPTeks}>
            🔔 Beli: {keadaanP.beliRingkas ?? 'tiada dijadualkan'}
            {'\n'}🔔 Jual: {keadaanP.jualRingkas ?? `tiada (dihantar ${fmtJam(tetapan.peringatan.masaJual)} jika untung ≥ +${tetapan.peringatan.ambangR}R atau hari terakhir)`}
          </Text>
        )}
      </Pressable>

      <Segmen pilihan={SEMUA_HORIZON} nilai={h} tukar={setH} label={(x) => INFO_HORIZON[x].label} sub={(x) => INFO_HORIZON[x].pegangan} />

      {!data ? (
        <Kosong tajuk="Menunggu data" teks="Tarik ke bawah untuk muat semula." />
      ) : !cad ? (
        <Kosong tajuk="Cadangan belum tersedia" teks="Cadangan akan muncul selepas analisa harian seterusnya." />
      ) : (
        <>
          <Text style={[st.kecil, { marginBottom: 10 }]}>
            {INFO_HORIZON[h].ringkas} · pegangan maksimum {cad.pegangan_hari} hari dagangan · pelan sah hingga {fmtTarikh(cad.sah_hingga)}
          </Text>
          {cad.nota.map((n, i) => (
            <View key={i} style={st.nota}>
              <Text style={st.notaTeks}>⚠︎ {n}</Text>
            </View>
          ))}

          <Text style={[st.label, { color: warna.bullish }]}>▲ Cadangan BELI</Text>
          {cad.beli.length ? (
            cad.beli.map((c) => {
              const dipilih = pilihan.some((p) => p.ticker === c.ticker && p.horizon === h && p.status === 'aktif');
              return <KadCadangan key={c.ticker} c={c} kos={kos} dipilih={dipilih} buka={() => bukaSaham(c.ticker, h)} pilih={() => pilih(c)} />;
            })
          ) : (
            <Kosong tajuk="Tiada cadangan beli hari ini" teks="Tiada saham memenuhi semua syarat. Kadang-kadang tidak berdagang adalah keputusan terbaik." />
          )}

          <Text style={[st.label, { color: warna.bearish, marginTop: 6 }]}>▼ ELAK / kurangkan pegangan</Text>
          {cad.elak.length ? (
            <Kad gaya={{ paddingVertical: 4 }}>
              {cad.elak.map((c, i) => (
                <Pressable key={c.ticker} onPress={() => bukaSaham(c.ticker, h)} style={[st.barisElak, i > 0 && { borderTopWidth: 1, borderTopColor: warna.garis }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.namaKecil}>
                      {c.nama} <Text style={st.kod}>{c.kod}</Text> <Text style={{ color: WARNA_GRED[c.gred], fontSize: 12 }}>· Gred {c.gred}</Text>
                    </Text>
                    <Text style={st.kecil} numberOfLines={1}>
                      {c.alasan[0] ?? ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.hargaKecil}>{fmtHarga(c.harga)}</Text>
                    <Text style={st.kecil}>batal &gt; {fmtHarga(c.henti_rugi)}</Text>
                  </View>
                </Pressable>
              ))}
            </Kad>
          ) : (
            <Text style={[st.kecil, { marginBottom: 12 }]}>Tiada saham dalam senarai elak bagi horizon ini.</Text>
          )}

          <Text style={st.label}>Pilihan saya · {INFO_HORIZON[h].label}</Text>
          {milikH.length ? (
            milikH.map((p) => (
              <KadPilihan
                key={p.id}
                p={p}
                kos={kos}
                hl={langsung[p.ticker]}
                hari={hariDipegang(p, data)}
                buka={() => bukaSaham(p.ticker, h)}
                buang={() =>
                  Alert.alert('Buang pilihan?', `${p.nama} akan dibuang daripada Pilihan Saya.`, [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Buang', style: 'destructive', onPress: () => buangPilihan(p.id) },
                  ])
                }
              />
            ))
          ) : (
            <Text style={[st.kecil, { marginBottom: 12 }]}>
              Tekan "Pilih" pada cadangan (atau pada mana-mana saham dalam tab Saham) untuk memantau dagangan anda. App akan memaklumkan apabila sasaran
              atau henti rugi dicapai.
            </Text>
          )}

          <Text style={st.label}>Rekod cadangan {INFO_HORIZON[h].label}</Text>
          <Kad>
            {pc && (pc.beli.n || pc.elak.n) ? (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 6 }}>
                <Stat tajuk="BELI" w={warna.bullish} n={pc.beli.n} kadar={pc.beli.kadar_menang} r={pc.beli.purata_r} />
                <Stat tajuk="ELAK" w={warna.bearish} n={pc.elak.n} kadar={pc.elak.kadar_menang} r={pc.elak.purata_r} />
              </View>
            ) : (
              <Text style={st.teks}>Rekod bermula {fmtTarikh(data.tarikh_data)}. Keputusan pertama selepas cadangan mencapai sasaran, henti rugi atau tamat tempoh.</Text>
            )}
            {pc && (pc.beli.ujian_balik || pc.elak.ujian_balik) ? (
              <Text style={[st.kecil, { marginBottom: 4 }]}>
                Termasuk {(pc.beli.ujian_balik ?? 0) + (pc.elak.ujian_balik ?? 0)} cadangan ujian balik — dikira semula daripada ranking yang direkod{' '}
                {fmtTarikh(pc.ujian_balik_dari)} hingga {fmtTarikh(pc.ujian_balik_hingga)} menggunakan syarat cadangan semasa.
              </Text>
            ) : null}
            {pc?.belum_dinilai ? <Text style={st.kecil}>{pc.belum_dinilai} cadangan masih dalam tempoh pegangan.</Text> : null}
            {lepas.map((r, i) => (
              <View key={i} style={st.barisLepas}>
                <Text style={{ color: r.r > 0 ? warna.bullish : warna.bearish, width: 16, fontWeight: '900' }}>{r.r > 0 ? '✓' : '✗'}</Text>
                <Text style={[st.kecil, { width: 52 }]}>{fmtTarikh(r.tarikh).replace(/ \d{4}$/, '')}</Text>
                <Text style={[st.teks, { flex: 1 }]} numberOfLines={1}>
                  {r.tindakan} {r.nama}
                  {r.ujian_balik ? <Text style={st.kecil}> · UB</Text> : null}
                </Text>
                <Text style={st.kecil}>{r.hasil === 'sasaran' ? 'sasaran' : r.hasil === 'henti' ? 'henti rugi' : 'tamat'} </Text>
                <Text style={[st.hargaKecil, { color: r.r > 0 ? warna.bullish : warna.bearish, width: 52, textAlign: 'right' }]}>
                  {r.r > 0 ? '+' : ''}
                  {r.r.toFixed(2)}R
                </Text>
              </View>
            ))}
            <Text style={[st.kecil, { marginTop: 6 }]}>
              R = untung/rugi berbanding risiko (jarak ke henti rugi). +2R bermaksud untung dua kali ganda risiko. UB = ujian balik.
            </Text>
            <Pressable onPress={bukaPrestasi} style={{ marginTop: 8 }}>
              <Text style={{ color: warna.aksen, fontWeight: '700' }}>Prestasi ranking & pembelajaran ›</Text>
            </Pressable>
          </Kad>
        </>
      )}
      <Text style={[st.kecil, { textAlign: 'center', marginTop: 4 }]}>
        Cadangan dijana secara automatik daripada analisa teknikal. Bukan nasihat pelaburan — sentiasa gunakan henti rugi.
      </Text>
    </ScrollView>
  );
}

function KadCadangan({ c, kos, dipilih, buka, pilih }: { c: PelanCadangan; kos: TetapanKos; dipilih: boolean; buka: () => void; pilih: () => void }) {
  const reit = c.sektor === 'REIT';
  const unit = unitUntukModal(kos.modal, c.harga);
  const aS = anggar(unit, c.harga, c.sasaran, kos, reit);
  const aH = anggar(unit, c.harga, c.henti_rugi, kos, reit);
  return (
    <Pressable onPress={buka} style={({ pressed }) => [st.kad, pressed && { backgroundColor: warna.kadTinggi }]}>
      <View style={st.baris}>
        <View style={[st.gred, { borderColor: WARNA_GRED[c.gred] }]}>
          <Text style={[st.gredTeks, { color: WARNA_GRED[c.gred] }]}>{c.gred}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.nama} numberOfLines={1}>
            {c.nama} <Text style={st.kod}>{c.kod}</Text>
          </Text>
          <Text style={st.kecil} numberOfLines={1}>
            {c.sektor} · Ranking #{c.kedudukan} · yakin {c.keyakinan}%
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={st.harga}>{fmtHarga(c.harga)}</Text>
          <Text style={[st.kecil, { color: (c.ubah_peratus ?? 0) >= 0 ? warna.bullish : warna.bearish }]}>{fmtPeratus(c.ubah_peratus)}</Text>
        </View>
      </View>
      <View style={st.pelan}>
        <Sel label="Zon masuk" nilai={`${fmtHarga(c.zon_masuk[0])}–${fmtHarga(c.zon_masuk[1])}`} />
        <Sel label="Henti rugi" nilai={fmtHarga(c.henti_rugi)} sub={`-${c.risiko_peratus}%`} w={warna.bearish} />
        <Sel label="Sasaran" nilai={fmtHarga(c.sasaran)} sub={`+${c.ganjaran_peratus}%`} w={warna.bullish} />
        <Sel label="Nisbah" nilai={`1:${c.nisbah_rr.toFixed(1)}`} />
      </View>
      {aS && aH ? (
        <View style={st.anggar}>
          <Text style={st.kecil}>
            Modal RM{kos.modal.toLocaleString('en-MY')} → {unit} unit (RM{aS.nilaiBeli.toFixed(0)}) · kos moomoo beli+jual ≈ RM{aS.kos.toFixed(2)}
          </Text>
          <Text style={st.anggarTeks}>
            Bersih: sasaran <Text style={{ color: warna.bullish }}>{fmtRMx(aS.bersih)}</Text> · henti rugi <Text style={{ color: warna.bearish }}>{fmtRMx(aH.bersih)}</Text>
          </Text>
        </View>
      ) : (
        <Text style={[st.kecil, { marginTop: 8 }]}>Modal RM{kos.modal} tidak cukup untuk 1 lot (100 unit) saham ini.</Text>
      )}
      {c.alasan.length ? (
        <Text style={st.alasan} numberOfLines={2}>
          {c.alasan.slice(0, 2).join(' · ')}
        </Text>
      ) : null}
      <View style={[st.baris, { marginTop: 8, gap: 6 }]}>
        {c.selari.map((x) => (
          <View key={x} style={st.cipSelari}>
            <Text style={st.cipSelariTeks}>Selari {x}</Text>
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={st.pautan}>Graf ›</Text>
        <Pressable
          onPress={dipilih ? undefined : pilih}
          hitSlop={8}
          style={[st.butangPilih, dipilih && { backgroundColor: 'transparent', borderColor: warna.bullish }]}
          accessibilityRole="button"
        >
          <Text style={[st.butangPilihTeks, dipilih && { color: warna.bullish }]}>{dipilih ? '✓ Dipilih' : 'Pilih'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function KadPilihan({ p, kos, hl, hari, buka, buang }: { p: PilihanSaya; kos: TetapanKos; hl?: CacheLangsung['harga'][string]; hari: number; buka: () => void; buang: () => void }) {
  const adaLangsung = !!hl && p.status === 'aktif' && tarikhMYT(hl.masa * 1000) === tarikhMYT(Date.now()) && tarikhMYT(hl.masa * 1000) > (p.tarikh_semasa ?? '');
  const kini = adaLangsung ? hl!.harga : p.harga_semasa ?? p.harga_masuk;
  const u = adaLangsung ? ((kini - p.harga_masuk) / p.harga_masuk) * 100 : untungPeratus(p);
  const r = (kini - p.harga_masuk) / (p.harga_masuk - p.henti_rugi || 1);
  const m = adaLangsung ? minitMYT(hl!.masa * 1000) : 0;
  const a = anggar(unitUntukModal(kos.modal, p.harga_masuk), p.harga_masuk, kini, kos);
  const kedudukan = Math.max(0, Math.min(1, (kini - p.henti_rugi) / (p.sasaran - p.henti_rugi || 1)));
  const masuk = Math.max(0, Math.min(1, (p.harga_masuk - p.henti_rugi) / (p.sasaran - p.henti_rugi || 1)));
  const wStatus = p.status === 'sasaran' ? warna.bullish : p.status === 'henti' ? warna.bearish : p.status === 'tamat' ? warna.amaran : warna.aksen;
  return (
    <Pressable onPress={buka} onLongPress={buang} style={({ pressed }) => [st.kad, pressed && { backgroundColor: warna.kadTinggi }]}>
      <View style={st.baris}>
        <View style={{ flex: 1 }}>
          <Text style={st.nama}>
            {p.nama} <Text style={st.kod}>{p.kod}</Text>
          </Text>
          <Text style={st.kecil}>
            Dipilih {fmtTarikh(p.tarikh)} · hari {Math.min(hari, p.pegangan_hari)}/{p.pegangan_hari}
            {p.gred ? ` · gred ${p.gred}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[st.harga, { color: u >= 0 ? warna.bullish : warna.bearish }]}>{fmtPeratus(u)}</Text>
          <View style={[st.cipStatus, { borderColor: wStatus }]}>
            <Text style={[st.cipStatusTeks, { color: wStatus }]}>{LABEL_STATUS[p.status]}</Text>
          </View>
        </View>
      </View>
      <View style={st.trek}>
        <View style={[st.penanda, { left: `${masuk * 100}%`, backgroundColor: warna.teksMalap }]} />
        <View style={[st.titik, { left: `${kedudukan * 100}%`, backgroundColor: u >= 0 ? warna.bullish : warna.bearish }]} />
      </View>
      <View style={st.baris}>
        <Text style={[st.kecil, { color: warna.bearish }]}>Henti {fmtHarga(p.henti_rugi)}</Text>
        <Text style={[st.kecil, { flex: 1, textAlign: 'center' }]}>
          Masuk {fmtHarga(p.harga_masuk)} → {adaLangsung ? `langsung ${fmtJam(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`)}` : 'tutup'} {fmtHarga(kini)}
        </Text>
        <Text style={[st.kecil, { color: warna.bullish }]}>Sasaran {fmtHarga(p.sasaran)}</Text>
      </View>
      {a ? (
        <Text style={[st.kecil, { marginTop: 6 }]}>
          {r >= 0 ? '+' : ''}
          {r.toFixed(1)}R · jika jual sekarang ({a.unit} unit): <Text style={{ color: a.bersih >= 0 ? warna.bullish : warna.bearish, fontWeight: '800' }}>{fmtRMx(a.bersih)}</Text> bersih selepas kos RM
          {a.kos.toFixed(2)}
        </Text>
      ) : null}
      <Pressable onPress={buang} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
        <Text style={[st.kecil, { color: warna.teksMalap }]}>Buang</Text>
      </Pressable>
    </Pressable>
  );
}

function Sel({ label, nilai, sub, w = warna.teks }: { label: string; nilai: string; sub?: string; w?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={st.kecil}>{label}</Text>
      <Text style={[st.selNilai, { color: w }]}>{nilai}</Text>
      {sub ? <Text style={[st.kecil, { color: w }]}>{sub}</Text> : null}
    </View>
  );
}

function Stat({ tajuk, w, n, kadar, r }: { tajuk: string; w: string; n: number; kadar: number | null; r: number | null }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: w, fontWeight: '800' }}>{tajuk}</Text>
      <Text style={st.besar}>{kadar != null ? `${kadar}%` : '—'}</Text>
      <Text style={st.kecil}>
        menang · {n} cadangan · purata {r != null ? `${r > 0 ? '+' : ''}${r.toFixed(2)}R` : '—'}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  atas: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  jenama: { color: warna.teks, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  klci: { color: warna.teks, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] },
  kecil: { color: warna.teksLemah, fontSize: 12, lineHeight: 17 },
  teks: { color: warna.teks, fontSize: 13, lineHeight: 19 },
  label: { color: warna.teksLemah, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  nota: { backgroundColor: warna.amaranLatar, borderRadius: 10, padding: 10, marginBottom: 8 },
  notaTeks: { color: warna.amaran, fontSize: 12, lineHeight: 17 },
  pitaP: { backgroundColor: warna.kad, borderWidth: 1, borderColor: warna.garis, borderRadius: 10, padding: 10, marginBottom: 10 },
  pitaPTeks: { color: warna.teksLemah, fontSize: 12, lineHeight: 18 },
  anggar: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: warna.garis },
  anggarTeks: { color: warna.teks, fontSize: 13, fontWeight: '700', marginTop: 2 },
  kad: { backgroundColor: warna.kad, borderRadius: 14, borderWidth: 1, borderColor: warna.garis, padding: 12, marginBottom: 10 },
  baris: { flexDirection: 'row', alignItems: 'center' },
  gred: { width: 34, height: 34, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  gredTeks: { fontSize: 17, fontWeight: '900' },
  nama: { color: warna.teks, fontSize: 15, fontWeight: '800' },
  namaKecil: { color: warna.teks, fontSize: 14, fontWeight: '700' },
  kod: { color: warna.teksMalap, fontSize: 12, fontWeight: '400' },
  harga: { color: warna.teks, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hargaKecil: { color: warna.teks, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pelan: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: warna.garis },
  selNilai: { color: warna.teks, fontSize: 13, fontWeight: '800', marginTop: 1, fontVariant: ['tabular-nums'] },
  alasan: { color: warna.teksLemah, fontSize: 12, lineHeight: 17, marginTop: 8 },
  cipSelari: { backgroundColor: warna.aksenLatar, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cipSelariTeks: { color: warna.aksen, fontSize: 11, fontWeight: '700' },
  pautan: { color: warna.aksen, fontSize: 13, fontWeight: '700', marginRight: 10 },
  butangPilih: { backgroundColor: warna.bullish, borderColor: warna.bullish, borderWidth: 1, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 6 },
  butangPilihTeks: { color: '#062611', fontWeight: '800', fontSize: 13 },
  barisElak: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 8 },
  barisLepas: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 4 },
  besar: { color: warna.teks, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  cipStatus: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginTop: 3 },
  cipStatusTeks: { fontSize: 11, fontWeight: '800' },
  trek: { height: 6, borderRadius: 3, backgroundColor: warna.garis, marginTop: 12, marginBottom: 6 },
  penanda: { position: 'absolute', width: 2, height: 10, top: -2, marginLeft: -1 },
  titik: { position: 'absolute', width: 12, height: 12, borderRadius: 6, top: -3, marginLeft: -6, borderWidth: 2, borderColor: warna.kad },
});
