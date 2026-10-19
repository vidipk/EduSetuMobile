import { useEffect, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { shouldRetry } from '@/api/query-policy';
import { AuthProvider } from '@/auth/AuthProvider';
import { registerSessionInvalidation } from '@/auth/session-invalidation';
import { ThemeProvider } from '@/design-system/theme/ThemeProvider';
import { useLearningExperience } from '@/features/learning/experience-store';
import { useParentContext } from '@/stores/parent-context';

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: shouldRetry, refetchOnReconnect: true }, mutations: { retry: false } } });

function NativeLifecycleBridge() {
  useEffect(() => {
    onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))));
    const subscription = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    const unregister = registerSessionInvalidation(() => { queryClient.clear(); useParentContext.getState().reset(); useLearningExperience.getState().reset(); });
    return () => { subscription.remove(); unregister(); };
  }, []);
  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><NativeLifecycleBridge /><AuthProvider><ThemeProvider>{children}</ThemeProvider></AuthProvider></QueryClientProvider></SafeAreaProvider>;
}
