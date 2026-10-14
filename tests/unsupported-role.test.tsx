import { fireEvent, render } from '@testing-library/react-native';

import Unsupported from '@/app/unsupported-role';
import { useAuth } from '@/auth/AuthProvider';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text testID="redirect">{href}</Text>;
  },
}));

jest.mock('lucide-react-native', () => ({
  Eye: () => null,
  EyeOff: () => null,
  Search: () => null,
}));

jest.mock('@/auth/AuthProvider', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = jest.mocked(useAuth);
const unsupportedUser = {
  id: 'admin',
  fullName: 'School Admin',
  email: 'admin@example.test',
  role: 'SCHOOL_ADMIN' as const,
  status: 'ACTIVE' as const,
  organizationId: 'organization',
  organization: null,
};

test('unsupported-role sign out uses logout and redirects after authentication clears', async () => {
  const logout = jest.fn();
  mockedUseAuth.mockReturnValue({ user: unsupportedUser, status: 'authenticated', login: jest.fn(), logout, logoutAll: jest.fn() });

  const screen = await render(<Unsupported />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(logout).toHaveBeenCalledTimes(1);

  mockedUseAuth.mockReturnValue({ user: null, status: 'unauthenticated', login: jest.fn(), logout, logoutAll: jest.fn() });
  await screen.rerender(<Unsupported />);
  expect(screen.getByTestId('redirect')).toHaveTextContent('/(auth)/login');
});
