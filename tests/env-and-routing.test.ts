import { parseEnvironment } from '@/config/env';
import { roleDestination } from '@/auth/role-routing';
import { fallbackTheme } from '@/design-system/theme/ThemeProvider';
import { useParentContext } from '@/stores/parent-context';
import { AppApiError } from '@/api/client/error';
import { shouldRetry } from '@/api/query-policy';

test('parses required environment values', () => expect(parseEnvironment({ APP_ENV: 'staging', EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test/api/v1', EXPO_PUBLIC_ENABLE_PUSH: 'false', EXPO_PUBLIC_ENABLE_AI: 'true' }).APP_ENV).toBe('staging'));
test('rejects an API URL without the version prefix', () => expect(() => parseEnvironment({ EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test' })).toThrow());
test.each([['STUDENT','/(student)/(tabs)'],['PARENT','/(parent)/(tabs)'],['TEACHER','/(teacher)/(tabs)'],['SCHOOL_ADMIN','/unsupported-role']] as const)('routes %s correctly', (role, destination) => expect(roleDestination(role)).toBe(destination));
test('uses the EduSetu fallback theme', () => expect(fallbackTheme.primary).toBe('#035352'));
test('resets selected parent child context', () => { useParentContext.getState().selectStudent('student-1'); useParentContext.getState().reset(); expect(useParentContext.getState().selectedStudentProfileId).toBeNull(); });
test('does not retry permanent API failures', () => expect(shouldRetry(0, new AppApiError('Unauthorized', 401))).toBe(false));
