import { z } from 'zod';
const booleanString=z.enum(['true','false']).transform(v=>v==='true');
const schema=z.object({APP_ENV:z.enum(['development','staging','production']).default('development'),EXPO_PUBLIC_API_BASE_URL:z.string().url().refine(v=>v.endsWith('/api/v1'),'must end with /api/v1'),EXPO_PUBLIC_SENTRY_DSN:z.string().url().optional().or(z.literal('')),EXPO_PUBLIC_ENABLE_PUSH:booleanString.default(false),EXPO_PUBLIC_ENABLE_AI:booleanString.default(true)});
export type AppEnvironment=z.infer<typeof schema>;
export const parseEnvironment=(source:Record<string,string|undefined>):AppEnvironment=>schema.parse(source);
export const env=parseEnvironment({APP_ENV:process.env.APP_ENV,EXPO_PUBLIC_API_BASE_URL:process.env.EXPO_PUBLIC_API_BASE_URL,EXPO_PUBLIC_SENTRY_DSN:process.env.EXPO_PUBLIC_SENTRY_DSN,EXPO_PUBLIC_ENABLE_PUSH:process.env.EXPO_PUBLIC_ENABLE_PUSH,EXPO_PUBLIC_ENABLE_AI:process.env.EXPO_PUBLIC_ENABLE_AI});
