import * as Crypto from 'expo-crypto'; import * as SecureStore from 'expo-secure-store'; import { env } from '@/config/env';
const key=`edusetu.${env.APP_ENV}.installation-id`;
export const createInstallationIdService=(storage=SecureStore,uuid=Crypto.randomUUID)=>({async get(){const existing=await storage.getItemAsync(key);if(existing)return existing;const created=uuid();await storage.setItemAsync(key,created);return created;}});
export const installationId=createInstallationIdService();
