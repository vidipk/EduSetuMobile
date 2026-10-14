import * as Application from 'expo-application'; import { Platform } from 'react-native'; import type { MobilePlatform } from '@/api/contracts/auth';
export const getAppMetadata=()=>({platform:(Platform.OS==='ios'?'IOS':'ANDROID') as MobilePlatform,appVersion:Application.nativeApplicationVersion??undefined});
