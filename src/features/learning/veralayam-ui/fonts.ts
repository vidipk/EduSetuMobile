import { useFonts } from 'expo-font';

/** Inter is bundled in assets/fonts (OFL-1.1). Loading is non-blocking: until ready the system font is used. */
export function useVeralayamFonts() {
  const [loaded, error] = useFonts({
    Inter_400Regular: require('../../../../assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('../../../../assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('../../../../assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('../../../../assets/fonts/Inter_700Bold.ttf'),
    Inter_800ExtraBold: require('../../../../assets/fonts/Inter_800ExtraBold.ttf'),
  });
  return loaded || Boolean(error);
}
