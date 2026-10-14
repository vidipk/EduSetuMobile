import { create, type AxiosInstance } from 'axios';
import type { MobileLoginRequest, MobileRefreshRequest, MobileSession } from '@/api/contracts/auth';
import { env } from '@/config/env';

export const authTransport = create({ baseURL: env.EXPO_PUBLIC_API_BASE_URL, timeout: 20_000 });
export const createAuthApi=(client:Pick<AxiosInstance,'post'>=authTransport)=>({login:async(p:MobileLoginRequest)=>(await client.post<MobileSession>('/auth/mobile/login',p)).data,refresh:async(p:MobileRefreshRequest)=>(await client.post<MobileSession>('/auth/mobile/refresh',p)).data,logout:async(t:string)=>{await client.post('/auth/mobile/logout',undefined,{headers:{Authorization:`Bearer ${t}`}});},logoutAll:async(t:string)=>{await client.post('/auth/logout-all',undefined,{headers:{Authorization:`Bearer ${t}`}});}}); export const authApi=createAuthApi();
