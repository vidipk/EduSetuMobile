import type { ConfigContext, ExpoConfig } from 'expo/config';

const appEnvironment = process.env.APP_ENV ?? 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'EduSetu',
  slug: 'edusetu-mobile',
  scheme: 'edusetu',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/images/icon.png',
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sharing',
    // Voice learning needs RECORD_AUDIO, so the camera plugin must not strip it.
    ['expo-camera', { recordAudioAndroid: true, microphonePermission: 'EduSetu uses the microphone only during voice learning sessions you start.' }],
    // Not `false`: that blocks RECORD_AUDIO app-wide, which voice learning needs.
    ['expo-image-picker', { microphonePermission: 'EduSetu uses the microphone only during voice learning sessions you start.' }],
    'expo-document-picker',
    '@sentry/react-native/expo',
    '@livekit/react-native-expo-plugin',
  ],
  experiments: { typedRoutes: true },
  extra: { appEnvironment },
  ios: { supportsTablet: true },
  android: {
    // Temporary internal-testing identity. A Play Store package ID needs product approval.
    package: 'com.edusetu.mobile.internal',
    versionCode: 1,
    permissions: ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'],
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: '#F3E8BC',
    },
  },
});
