import { Redirect, Stack } from 'expo-router';

import { LoadingState } from '@/design-system/components';
import { useAuth } from '@/auth/AuthProvider';

export default function StudentLayout() {
  const { status, user } = useAuth();
  if (status === 'bootstrapping') return <LoadingState label="Restoring session..." />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'STUDENT') return <Redirect href="/unsupported-role" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
