import type { PlatformRole } from '@/api/contracts/auth';

export type RoleDestination = '/(student)/(tabs)' | '/(parent)/(tabs)' | '/(teacher)/(tabs)' | '/unsupported-role';

export function roleDestination(role: PlatformRole): RoleDestination {
  if (role === 'STUDENT') return '/(student)/(tabs)';
  if (role === 'PARENT') return '/(parent)/(tabs)';
  if (role === 'TEACHER') return '/(teacher)/(tabs)';
  return '/unsupported-role';
}
