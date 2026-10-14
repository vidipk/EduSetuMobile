import { Stack } from 'expo-router';

import { AppErrorBoundary } from '@/observability/ErrorBoundary';
import { initializeObservability } from '@/observability/sentry';
import { AppProviders } from '@/providers/AppProviders';

initializeObservability();

export default function RootLayout() {
  return <AppErrorBoundary><AppProviders><Stack screenOptions={{ headerShown: false }} /></AppProviders></AppErrorBoundary>;
}
