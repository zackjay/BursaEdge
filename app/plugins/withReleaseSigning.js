// Plugin konfigurasi: tandatangan APK release dengan keystore tetap (daripada
// pemboleh ubah persekitaran) supaya setiap versi baru boleh dipasang sebagai
// kemas kini tanpa perlu buang app lama. Jika tiada keystore, guna kunci debug.
const { withAppBuildGradle } = require('expo/config-plugins');

const PENANDA = '// bursaedge-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes(PENANDA)) return cfg;

    const blokRelease = `
        release { ${PENANDA}
            if (System.getenv("BURSAEDGE_KEYSTORE")) {
                storeFile file(System.getenv("BURSAEDGE_KEYSTORE"))
                storePassword System.getenv("BURSAEDGE_KEYSTORE_PASSWORD")
                keyAlias System.getenv("BURSAEDGE_KEY_ALIAS")
                keyPassword System.getenv("BURSAEDGE_KEY_PASSWORD")
            }
        }`;
    const sebelum = g;
    g = g.replace(/signingConfigs\s*\{/, (m) => `${m}${blokRelease}`);
    if (g === sebelum) throw new Error('withReleaseSigning: blok signingConfigs tidak dijumpai dalam app/build.gradle');

    // Dalam buildTypes.release, tukar kepada kunci release apabila keystore tersedia
    const r = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
    if (!r.test(g)) throw new Error('withReleaseSigning: signingConfig release tidak dijumpai');
    g = g.replace(r, '$1signingConfig (System.getenv("BURSAEDGE_KEYSTORE") ? signingConfigs.release : signingConfigs.debug)');
    cfg.modResults.contents = g;
    return cfg;
  });
};
