import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { learningApi } from '@/api/academics/learning';
import { useAuth } from '@/auth/AuthProvider';
import { useLearningExperience } from '@/features/learning/experience-store';
import { timestampLabel, TranscriptScreen } from '@/features/learning/TranscriptScreen';

let mockParams: Record<string, string> = { videoId: 'video-1', title: 'Episode 161' };
const mockSetParams = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true, push: jest.fn(), setParams: (...args: unknown[]) => mockSetParams(...args) },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/academics/learning', () => ({ learningApi: { transcript: jest.fn() } }));

const api = jest.mocked(learningApi);
const mockedUseAuth = jest.mocked(useAuth);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { videoId: 'video-1', title: 'Episode 161' };
  mockedUseAuth.mockReturnValue({
    user: {
      id: 'student-1',
      fullName: 'Asha',
      email: 'a@example.test',
      role: 'STUDENT',
      status: 'ACTIVE',
      organizationId: 'org-1',
      organization: { id: 'org-1', name: 'Veralayam', slug: 'veralayam', branding: { themeKey: 'x', primaryColor: '#000', accentColor: '#111', hasLogo: false, logoPath: null } },
    },
    status: 'authenticated',
    login: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
  });
  useLearningExperience.setState({ status: 'ready', enabled: true, config: null });
  api.transcript.mockResolvedValue({
    id: 'transcript-1',
    videoId: 'video-1',
    videoTitle: 'Episode 161',
    language: 'en',
    availableLanguages: ['en', 'gu'],
    originalText: 'Approved transcript text.',
    segments: [{ index: 0, startMs: 65_000, endMs: 70_000, text: 'Compassion is the root of every virtue.' }],
  });
});

test('shows only the approved transcript returned by the student API with readable timestamps', async () => {
  const screen = await render(<TranscriptScreen />);
  await waitFor(() => expect(screen.getByText('Compassion is the root of every virtue.')).toBeTruthy());
  expect(screen.getByText('Episode 161')).toBeTruthy();
  expect(screen.getAllByText('English')).toHaveLength(2);
  expect(screen.getByText('1:05')).toBeTruthy();
  expect(api.transcript).toHaveBeenCalledWith('video-1', undefined);
  expect(screen.getByRole('tab', { name: 'English' }).props.accessibilityState.selected).toBe(true);
  await act(async () => { fireEvent.press(screen.getByRole('tab', { name: 'Gujarati' })); });
  expect(mockSetParams).toHaveBeenCalledWith({ language: 'gu' });
  expect(timestampLabel(3_725_000)).toBe('1:02:05');
  expect(timestampLabel(null)).toBeNull();
});

test('standard-school students are redirected and never request an institution transcript', async () => {
  useLearningExperience.setState({ status: 'ready', enabled: false, config: null });
  const screen = await render(<TranscriptScreen />);
  expect(screen.getByText('redirect:/(student)/(tabs)/learn')).toBeTruthy();
  expect(api.transcript).not.toHaveBeenCalled();
});

test('missing transcript parameters produce an honest unavailable state', async () => {
  mockParams = {};
  const screen = await render(<TranscriptScreen />);
  expect(screen.getByText('Transcript not available')).toBeTruthy();
  expect(api.transcript).not.toHaveBeenCalled();
});
