import * as SecureStore from 'expo-secure-store'; import { env } from '@/config/env';
const key=`edusetu.${env.APP_ENV}.refresh-token`;
export interface SecureStorage{getRefreshToken():Promise<string|null>;setRefreshToken(value:string):Promise<void>;removeRefreshToken():Promise<void>}
export const secureStorage:SecureStorage={getRefreshToken:()=>SecureStore.getItemAsync(key),setRefreshToken:value=>SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),removeRefreshToken:()=>SecureStore.deleteItemAsync(key)};
