// Matikan R8 (minify) untuk bina release Android.
// Sebab: R8 merosakkan kelas WorkDatabase_Impl milik WorkManager (digunakan oleh
// expo-background-task), menyebabkan app crash sebaik dibuka:
//   "Failed to create an instance of class androidx.work.impl.WorkDatabase..."
const { withGradleProperties } = require('expo/config-plugins');

const TETAPAN = {
  'android.enableMinifyInReleaseBuilds': 'false',
  'android.enableShrinkResourcesInReleaseBuilds': 'false',
};

module.exports = function withNoMinify(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [kunci, nilai] of Object.entries(TETAPAN)) {
      const sedia = cfg.modResults.find((x) => x.type === 'property' && x.key === kunci);
      if (sedia) sedia.value = nilai;
      else cfg.modResults.push({ type: 'property', key: kunci, value: nilai });
    }
    return cfg;
  });
};
