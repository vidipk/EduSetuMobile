import { env } from '@/config/env';

export interface NativePushIdentity { deviceId: string; platform: 'IOS' | 'ANDROID'; token: string }

export function isPushEnabled() {
  return env.EXPO_PUBLIC_ENABLE_PUSH;
}
