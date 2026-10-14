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
    ['expo-camera', { recordAudioAndroid: false }],
    ['expo-image-picker', { microphonePermission: false }],
    'expo-document-picker',
    '@sentry/react-native/expo',
  ],
  experiments: { typedRoutes: true },
  extra: { appEnvironment },
  ios: { supportsTablet: true },
  android: {
    // Temporary internal-testing identity. A Play Store package ID needs product approval.
    package: 'com.edusetu.mobile.internal',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: '#F3E8BC',
    },
  },
});
