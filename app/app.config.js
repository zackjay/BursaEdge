// Konfigurasi app BursaEdge. Nilai daripada pemboleh ubah persekitaran diisi
// oleh GitHub Actions semasa bina (lihat .github/workflows/bina-*.yml).
const nomborBina = parseInt(process.env.BURSAEDGE_BUILD_NUMBER || '1', 10);

module.exports = () => ({
  expo: {
    name: 'BursaEdge',
    slug: 'bursaedge',
    version: '3.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    backgroundColor: '#0A0F1C',
    scheme: 'bursaedge',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0F1C',
    },
    ios: {
      bundleIdentifier: 'com.msims.bursaedge',
      buildNumber: String(nomborBina),
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.msims.bursaedge',
      versionCode: nomborBina,
      adaptiveIcon: {
        backgroundColor: '#0A0F1C',
        foregroundImage: './assets/android-icon-foreground.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED'],
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      [
        'expo-notifications',
        {
          // Notifikasi tempatan sahaja — tiada APNs/FCM, jadi tiada akaun Apple berbayar atau Firebase diperlukan
          enableRemoteNotifications: false,
          icon: './assets/notification-icon.png',
          color: '#22C55E',
        },
      ],
      'expo-background-task',
      'expo-secure-store',
      './plugins/withReleaseSigning',
    ],
    extra: {
      dataRepo: process.env.BURSAEDGE_DATA_REPO || '',
      cawangan: process.env.BURSAEDGE_DATA_BRANCH || 'main',
    },
  },
});
