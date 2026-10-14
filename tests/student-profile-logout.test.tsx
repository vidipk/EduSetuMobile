import { fireEvent, render, waitFor } from '@testing-library/react-native';

import StudentProfileScreen from '@/app/(student)/(tabs)/profile';
import { useAuth } from '@/auth/AuthProvider';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock('lucide-react-native', () => ({
  Eye: () => null,
  EyeOff: () => null,
  Search: () => null,
}));

jest.mock('@/auth/AuthProvider', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = jest.mocked(useAuth);

beforeEach(() => {
  mockReplace.mockClear();
});

test('student profile logout waits for auth clear and redirects to login', async () => {
  const logout = jest.fn(async () => undefined);
  mockedUseAuth.mockReturnValue({
    user: { id: 'student', fullName: 'Student One', email: 'student@example.test', role: 'STUDENT', status: 'ACTIVE', organizationId: 'org-1', organization: { id: 'org-1', name: 'EduSetu School', slug: 'edusetu-school', branding: { themeKey: 'default', primaryColor: '#2563eb', accentColor: '#16a34a', hasLogo: false, logoPath: null } } },
    status: 'authenticated',
    login: jest.fn(),
    logout,
    logoutAll: jest.fn(),
  });

  const screen = await render(<StudentProfileScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Log out' }));

  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
});
