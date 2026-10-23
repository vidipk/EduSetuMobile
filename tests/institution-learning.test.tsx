import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import StudentHomeRoute from '@/app/(student)/(tabs)/index';
import StudentLearnRoute from '@/app/(student)/(tabs)/learn';
import StudentNoticesRoute from '@/app/(student)/(tabs)/notices';
import StudentLayout from '@/app/(student)/_layout';
import { learningApi } from '@/api/academics/learning';
import type { LearningTask } from '@/api/contracts/learning';
import { useAuth } from '@/auth/AuthProvider';
import { ChangePasswordScreen, validateNewPassword } from '@/features/learning/ChangePasswordScreen';
import { DailyTasksSection } from '@/features/learning/DailyTasks';
import { useLearningExperience } from '@/features/learning/experience-store';
import { LearnScreen, durationLabel } from '@/features/learning/LearnScreen';
import { isYoutubeWatchUrl, openLecture } from '@/features/learning/open-video';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args), back: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = require('react');
    useEffect(callback, [callback]);
  },
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
  Stack: () => {
    const { Text } = require('react-native');
    return <Text>stack</Text>;
  },
}));

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/ai/AiHubScreen', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>standard-ai-hub</Text> };
});
jest.mock('@/api/academics/student-work', () => ({ studentWorkApi: {} }));
jest.mock('@/api/academics/learning', () => ({
  learningApi: {
    experience: jest.fn(),
    home: jest.fn(),
    tasks: jest.fn(),
    catalogue: jest.fn(),
    courses: jest.fn(),
    notices: jest.fn(),
    openVideo: jest.fn(),
    setReduceAnimations: jest.fn(),
    changePassword: jest.fn(),
    catalogCourses: jest.fn(),
    notifications: jest.fn(),
    unreadCount: jest.fn(),
    markNotificationRead: jest.fn(),
    markAllNotificationsRead: jest.fn(),
  },
}));

const api = jest.mocked(learningApi);
const mockedUseAuth = jest.mocked(useAuth);
const logout = jest.fn(async () => undefined);

const student = { id: 'student-1', fullName: 'Asha Patel', email: 'asha@example.test', role: 'STUDENT' as const, status: 'ACTIVE', organizationId: 'org-1', organization: { id: 'org-1', name: 'Veralayam', slug: 'veralayam', branding: { themeKey: 'x', primaryColor: '#000', accentColor: '#111', hasLogo: false, logoPath: null } } };

const config = { mascot: { enabled: true, name: 'Deepak', assetKey: null, messages: {} }, languages: ['hi', 'en', 'gu'], streakMilestones: [3, 7] };

const task = (overrides: Record<string, unknown> = {}): LearningTask => ({
  assignmentId: 'a1', quizId: 'q1', title: 'Daily quiz 1', durationMinutes: 10, assignedDate: '2026-10-19', dueAt: '2026-10-20T10:00:00.000Z',
  state: 'PENDING', overdue: false, attemptId: null, submittedAt: null, result: null, ...overrides,
} as LearningTask);

const video = (overrides: Record<string, unknown> = {}) => ({
  id: 'v1', title: 'Episode 161', thumbnailUrl: null, watchUrl: 'https://www.youtube.com/watch?v=abc', youtubeVideoId: 'abc', publishedAt: null, durationSeconds: 1510, language: 'hi', topic: { id: 't1', name: 'Gyansaar' }, ...overrides,
});

function setExperience(enabled: boolean) {
  useLearningExperience.setState(enabled ? { status: 'ready', enabled: true, config } : { status: 'ready', enabled: false, config: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: student, status: 'authenticated', login: jest.fn(), logout, logoutAll: jest.fn() });
  useLearningExperience.getState().reset();
  api.tasks.mockResolvedValue([]);
  api.courses.mockResolvedValue([]);
  api.catalogCourses.mockResolvedValue([]);
  api.unreadCount.mockResolvedValue(0);
  api.catalogue.mockResolvedValue({ items: [], topics: [], meta: { page: 1, limit: 12, total: 0, totalPages: 1 } });
});

// ------------------------------------------------------------ routing by tenant

test('standard schools keep the standard Home, Learn and Notices screens', async () => {
  setExperience(false);
  const home = await render(<StudentHomeRoute />);
  expect(home.getByText('My performance')).toBeTruthy();
  expect(api.home).not.toHaveBeenCalled();
  expect((await render(<StudentLearnRoute />)).getByText('standard-ai-hub')).toBeTruthy();
  expect((await render(<StudentNoticesRoute />)).getByText('Notices')).toBeTruthy();
  expect(api.notices).not.toHaveBeenCalled();
  expect(api.catalogue).not.toHaveBeenCalled();
});

test('an unresolved or failed experience lookup falls back to the standard screens', async () => {
  useLearningExperience.setState({ status: 'failed', enabled: false, config: null });
  expect((await render(<StudentLearnRoute />)).getByText('standard-ai-hub')).toBeTruthy();
});

test('the institution Home shows real persisted data only and a guide when configured', async () => {
  setExperience(true);
  api.home.mockResolvedValue({
    learner: { fullName: 'Asha Patel', organizationName: 'Veralayam', className: '8 A' },
    streak: { current: 3, longest: 5, lastActivityDate: '2026-10-19', today: '2026-10-19' },
    quizStatistics: { completed: 4, resultsReleased: 3, averagePercentage: 82.5 },
    pendingToday: [task()],
    recentActivity: [{ attemptId: 'x1', quizId: 'q0', title: 'Earlier quiz', submittedAt: '2026-10-18T10:00:00Z', percentage: '90', resultReleased: true }],
    continueLearning: { id: 'v1', title: 'Episode 161', thumbnailUrl: null, watchUrl: 'https://www.youtube.com/watch?v=abc' },
    recommendedRevision: [{ topicId: 't1', name: 'Gyansaar', attempts: 2, averagePercentage: 45, strength: false, needsRevision: true }],
    mascot: { enabled: true, state: 'DAILY_TASK_AVAILABLE', message: null, reduceAnimations: false },
  });
  const screen = await render(<StudentHomeRoute />);
  await waitFor(() => expect(screen.getByText('Hi, Asha!')).toBeTruthy());
  expect(screen.getByText('Daily quiz 1')).toBeTruthy(); // today's focus is the one pending assigned quiz
  expect(screen.getByText('82.5%')).toBeTruthy();
  expect(screen.getByLabelText(/Deepak says/)).toBeTruthy(); // mascot sits in the hero card slot
  expect(screen.getByText('Earlier quiz result is ready')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText('Start quiz')); });
  expect(mockPush).toHaveBeenCalledWith('/(student)/quiz/q1');
});

test('Home never invents data when nothing exists', async () => {
  setExperience(true);
  api.home.mockResolvedValue({
    learner: { fullName: 'Asha Patel', organizationName: null, className: null },
    streak: { current: 0, longest: 0, lastActivityDate: null, today: '2026-10-19' },
    quizStatistics: { completed: 0, resultsReleased: 0, averagePercentage: null },
    pendingToday: [], recentActivity: [], continueLearning: null, recommendedRevision: [],
    mascot: { enabled: false, state: 'WELCOME', message: null, reduceAnimations: false },
  });
  const screen = await render(<StudentHomeRoute />);
  await waitFor(() => expect(screen.getByText("You're all caught up")).toBeTruthy());
  expect(screen.getByText('Appears once results are released')).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.queryByText(/result is ready/)).toBeNull();
  expect(screen.queryByText(/Continue learning/)).toBeNull();
  expect(screen.queryByLabelText(/says/)).toBeNull(); // mascot disabled -> nothing rendered
});

// ------------------------------------------------------------------- Learn

test('Learn lists approved lectures and passes search, topic and language filters to the server', async () => {
  setExperience(true);
  api.catalogue.mockResolvedValue({ items: [video()], topics: [{ id: 't1', name: 'Gyansaar' }], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } });
  api.courses.mockResolvedValue([{ id: 'c1', title: 'Foundations', description: null, lessonsOpened: 1, lessons: [{ id: 'l1', title: 'L1', description: null, orderIndex: 1, opened: true }] }]);
  const screen = await render(<LearnScreen />);
  await waitFor(() => expect(screen.getByText('Episode 161')).toBeTruthy());
  expect(screen.getByText('Gyansaar · 25:10 · HI')).toBeTruthy();
  expect(screen.getByText('Foundations')).toBeTruthy();

  await act(async () => { fireEvent.press(screen.getByText('English')); });
  await waitFor(() => expect(api.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'en', page: 1 })));
  await act(async () => { fireEvent.press(screen.getAllByText('Gyansaar')[0]); });
  await waitFor(() => expect(api.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ topicId: 't1' })));
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Search'), 'compassion'); });
  await waitFor(() => expect(api.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'compassion' })));
});

test('Learn shows an empty state and supports loading more pages', async () => {
  setExperience(true);
  api.catalogue.mockResolvedValueOnce({ items: [video()], topics: [], meta: { page: 1, limit: 12, total: 2, totalPages: 2 } });
  api.catalogue.mockResolvedValueOnce({ items: [video({ id: 'v2', title: 'Episode 162' })], topics: [], meta: { page: 2, limit: 12, total: 2, totalPages: 2 } });
  const screen = await render(<LearnScreen />);
  await waitFor(() => expect(screen.getByText('Episode 161')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByText('Load more')); });
  await waitFor(() => expect(screen.getByText('Episode 162')).toBeTruthy());
  expect(screen.getByText('Episode 161')).toBeTruthy();
});

test('Learn reports empty results and API failures without crashing', async () => {
  setExperience(true);
  const empty = await render(<LearnScreen />);
  await waitFor(() => expect(empty.getByText('No lectures found')).toBeTruthy());
  await empty.unmount();
  api.catalogue.mockRejectedValue(new Error('network'));
  const failed = await render(<LearnScreen />);
  await waitFor(() => expect(failed.getByText('Try again')).toBeTruthy());
  await failed.unmount();
});

test('lectures open through the YouTube link with a browser fallback and are never played in-app', async () => {
  const deps = { openUrl: jest.fn().mockResolvedValue(undefined), openBrowser: jest.fn().mockResolvedValue(undefined), record: jest.fn().mockResolvedValue(undefined) };
  const watch = { id: 'v1', watchUrl: 'https://www.youtube.com/watch?v=abc' };
  expect(await openLecture(watch, deps)).toBe('app');
  expect(deps.openUrl).toHaveBeenCalledWith(watch.watchUrl);
  expect(deps.record).toHaveBeenCalledWith('v1');

  deps.openUrl.mockRejectedValueOnce(new Error('no handler'));
  expect(await openLecture(watch, deps)).toBe('browser');
  expect(deps.openBrowser).toHaveBeenCalledWith(watch.watchUrl);

  deps.openUrl.mockRejectedValueOnce(new Error('no handler'));
  deps.openBrowser.mockRejectedValueOnce(new Error('no browser'));
  expect(await openLecture(watch, deps)).toBe('failed');

  // A failing analytics call must not block opening the lecture.
  deps.record.mockRejectedValueOnce(new Error('offline'));
  expect(await openLecture(watch, deps)).toBe('app');

  // Only https YouTube links are ever opened.
  for (const bad of ['http://www.youtube.com/watch?v=1', 'https://evil.example/watch?v=1', 'javascript:alert(1)', 'not a url']) {
    expect(isYoutubeWatchUrl(bad)).toBe(false);
    expect(await openLecture({ id: 'v', watchUrl: bad }, deps)).toBe('blocked');
  }
  expect(isYoutubeWatchUrl('https://youtu.be/abc')).toBe(true);
  expect(durationLabel(3725)).toBe('1:02:05');
  expect(durationLabel(null)).toBeNull();
});

// ------------------------------------------------------------------- Tasks

test('Daily tasks show due dates, state and only released scores', async () => {
  api.tasks.mockResolvedValue([
    task(),
    task({ assignmentId: 'a2', quizId: 'q2', title: 'Quiz two', state: 'SUBMITTED', attemptId: 'at2' }),
    task({ assignmentId: 'a3', quizId: 'q3', title: 'Quiz three', state: 'GRADED', attemptId: 'at3', result: { score: '8', maxScore: '10', percentage: '80' } }),
    task({ assignmentId: 'a4', quizId: 'q4', title: 'Quiz four', overdue: true }),
  ] as never);
  const screen = await render(<DailyTasksSection />);
  await waitFor(() => expect(screen.getByText('Daily quiz 1')).toBeTruthy());
  expect(screen.getByText('Result not released yet')).toBeTruthy();
  expect(screen.getByText('Score 80%')).toBeTruthy();
  expect(screen.getByText('Past due')).toBeTruthy();
  expect(screen.getByText('Completed')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText('Daily quiz 1')); });
  expect(mockPush).toHaveBeenCalledWith('/(student)/quiz/q1');
});

test('Daily tasks says so plainly when nothing is assigned', async () => {
  const screen = await render(<DailyTasksSection />);
  await waitFor(() => expect(screen.getByText('No daily tasks are assigned right now.')).toBeTruthy());
});

// ------------------------------------------------------------------ Notices

test('institution Notifications come from the server feed with server-side read state', async () => {
  setExperience(true);
  const now = new Date().toISOString();
  api.notifications.mockResolvedValue({
    items: [{ id: 'n1', type: 'NOTICE', title: 'Holiday', message: 'School is closed Monday.', isRead: false, readAt: null, createdAt: now, noticeId: 'x', notice: { id: 'x', type: 'GENERAL', status: 'PUBLISHED', title: 'Holiday', publishedAt: now } }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  api.unreadCount.mockResolvedValue(1);
  api.markNotificationRead.mockResolvedValue(undefined);
  const screen = await render(<StudentNoticesRoute />);
  await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());
  expect(screen.getByText('Official notice')).toBeTruthy();
  expect(api.notifications).toHaveBeenCalledWith(1, 20, undefined);
  await act(async () => { fireEvent.press(screen.getByText('Holiday')); });
  expect(api.markNotificationRead).toHaveBeenCalledWith('n1');
});

// ------------------------------------------------- first login / password

test('a learner flagged for a password change is sent to the change-password screen', async () => {
  setExperience(false);
  mockedUseAuth.mockReturnValue({ user: { ...student, mustChangePassword: true }, status: 'authenticated', login: jest.fn(), logout, logoutAll: jest.fn() });
  expect((await render(<StudentLayout />)).getByText('redirect:/change-password')).toBeTruthy();
  mockedUseAuth.mockReturnValue({ user: student, status: 'authenticated', login: jest.fn(), logout, logoutAll: jest.fn() });
  expect((await render(<StudentLayout />)).getByText('stack')).toBeTruthy();
});

test('the layout asks the server which experience applies before rendering tabs', async () => {
  api.experience.mockResolvedValue({ enabled: true, experienceKey: 'VIDEO_LEARNING', config });
  const screen = await render(<StudentLayout />);
  await waitFor(() => expect(screen.getByText('stack')).toBeTruthy());
  expect(api.experience).toHaveBeenCalledTimes(1);
  expect(useLearningExperience.getState().enabled).toBe(true);

  useLearningExperience.getState().reset();
  api.experience.mockRejectedValue(new Error('offline'));
  await render(<StudentLayout />);
  await waitFor(() => expect(useLearningExperience.getState().status).toBe('failed'));
  expect(useLearningExperience.getState().enabled).toBe(false);
});

test('new password rules are enforced client-side and the form signs the learner out on success', async () => {
  expect(validateNewPassword('old12345', 'short1', 'short1')).toMatch(/at least 8/);
  expect(validateNewPassword('old12345', 'old12345', 'old12345')).toMatch(/different/);
  expect(validateNewPassword('old12345', 'abcdefgh', 'abcdefgh')).toMatch(/letter and one number/);
  expect(validateNewPassword('old12345', 'newpass123', 'other123')).toMatch(/do not match/);
  expect(validateNewPassword('old12345', 'newpass123', 'newpass123')).toBeNull();

  api.changePassword.mockResolvedValue(undefined);
  const screen = await render(<ChangePasswordScreen />);
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Current password'), 'old12345'); });
  await act(async () => { fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123'); });
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'newpass123'); });
  await act(async () => { fireEvent.press(screen.getByLabelText('Save new password')); });
  await waitFor(() => expect(api.changePassword).toHaveBeenCalledWith({ currentPassword: 'old12345', newPassword: 'newpass123' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
  expect(logout).toHaveBeenCalled();
});

test('a wrong current password is reported without leaving the form', async () => {
  const failure = Object.assign(new Error('Unauthorized'), { isAxiosError: true, response: { status: 401, data: { message: 'Current password is incorrect.' } } });
  api.changePassword.mockRejectedValue(failure);
  const screen = await render(<ChangePasswordScreen />);
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Current password'), 'wrong1234'); });
  await act(async () => { fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123'); });
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'newpass123'); });
  await act(async () => { fireEvent.press(screen.getByLabelText('Save new password')); });
  await waitFor(() => expect(screen.getByText('Your current password is not correct.')).toBeTruthy());
  expect(mockReplace).not.toHaveBeenCalled();
});

test('a forced password change uses temporary-credential wording and has no cancel', async () => {
  mockedUseAuth.mockReturnValue({ user: { ...student, mustChangePassword: true }, status: 'authenticated', login: jest.fn(), logout, logoutAll: jest.fn() });
  const screen = await render(<ChangePasswordScreen />);
  expect(screen.getByText('Set your new password')).toBeTruthy();
  expect(screen.getByLabelText('Temporary password')).toBeTruthy();
  expect(screen.queryByText('Cancel')).toBeNull();
});
