import { useEffect } from 'react';
import { Redirect, Stack, useSegments, type Href } from 'expo-router';

import { LoadingState } from '@/design-system/components';
import { useAuth } from '@/auth/AuthProvider';
import { useLearningExperience } from '@/features/learning/experience-store';

export default function StudentLayout() {
  const { status, user } = useAuth();
  const segments = useSegments() as string[];
  const experienceStatus = useLearningExperience((state) => state.status);
  const loadExperience = useLearningExperience((state) => state.load);
  const isStudent = user?.role === 'STUDENT';

  useEffect(() => {
    if (isStudent && experienceStatus === 'idle') void loadExperience();
  }, [isStudent, experienceStatus, loadExperience]);

  if (status === 'bootstrapping') return <LoadingState label="Restoring session..." />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'STUDENT') return <Redirect href="/unsupported-role" />;
  // The experience is decided before any tab renders so a learner never sees the wrong layout flash.
  if (experienceStatus === 'idle' || experienceStatus === 'loading') return <LoadingState label="Loading..." />;
  if (user.mustChangePassword && !segments.includes('change-password')) return <Redirect href={'/change-password' as Href} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
