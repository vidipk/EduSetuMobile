import type { PlatformRole } from '@/api/contracts/auth';

export type RoleDestination = '/(student)' | '/(parent)' | '/(teacher)' | '/unsupported-role';

export function roleDestination(role: PlatformRole): RoleDestination {
  if (role === 'STUDENT') return '/(student)';
  if (role === 'PARENT') return '/(parent)';
  if (role === 'TEACHER') return '/(teacher)';
  return '/unsupported-role';
}
