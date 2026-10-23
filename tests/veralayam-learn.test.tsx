import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import StudentLearnRoute from '@/app/(student)/(tabs)/learn';
import StudentTasksRoute from '@/app/(student)/(tabs)/tasks';
import AcademicDetailsRoute from '@/app/(student)/academic-details';
import StudentPerformanceRoute from '@/app/(student)/performance';
import { learningApi } from '@/api/academics/learning';
import { performanceApi } from '@/api/academics/performance';
import { studentWorkApi } from '@/api/academics/student-work';
import type { CatalogCourse, LearningTask } from '@/api/contracts/learning';
import { useAuth } from '@/auth/AuthProvider';
import { useLearningExperience } from '@/features/learning/experience-store';
import { ChapterDetailScreen, loadChapter } from '@/features/learning/subjects/ChapterDetailScreen';
import { SubjectDetailScreen } from '@/features/learning/subjects/SubjectDetailScreen';
import { filterChapters, filterSubjects, groupSubjects } from '@/features/learning/subjects/transform';
import { VeralayamTabBar } from '@/features/learning/veralayam-ui/VeralayamTabBar';
import { groupByRecency } from '@/features/learning/veralayam-ui/VeralayamNotifications';
import { VeralayamImprovementPlan } from '@/features/learning/veralayam-ui/VeralayamProgress';
import { initialsOf, VeralayamProfile } from '@/features/learning/veralayam-ui/VeralayamProfile';
import { dailyRow, homeworkRow } from '@/features/learning/veralayam-ui/VeralayamTasks';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args), back: jest.fn(), canGoBack: () => true },
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = require('react');
    useEffect(callback, [callback]);
  },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/ai/AiHubScreen', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>standard-ai-hub</Text> };
});
jest.mock('@/features/performance/MyPerformanceScreen', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>standard-performance</Text> };
});
jest.mock('@/api/academics/student-work', () => ({ studentWorkApi: { listQuizzes: jest.fn(), listHomework: jest.fn() } }));
jest.mock('@/api/academics/performance', () => ({ performanceApi: { getMyPerformance: jest.fn() } }));
jest.mock('@/api/academics/learning', () => ({
  learningApi: {
    experience: jest.fn(), home: jest.fn(), tasks: jest.fn(), catalogue: jest.fn(), courses: jest.fn(), catalogCourses: jest.fn(), courseLessons: jest.fn(),
    notifications: jest.fn(), unreadCount: jest.fn(), notices: jest.fn(), setReduceAnimations: jest.fn(),
  },
}));

const api = jest.mocked(learningApi);
const work = jest.mocked(studentWorkApi);
const perf = jest.mocked(performanceApi);
const mockedUseAuth = jest.mocked(useAuth);
const student = { id: 's1', fullName: 'Asha Patel', email: 'asha@example.test', role: 'STUDENT' as const, status: 'ACTIVE', organizationId: 'org-1', organization: { id: 'org-1', name: 'Test Institute', slug: 't', branding: { themeKey: 'x', primaryColor: '#000', accentColor: '#111', hasLogo: false, logoPath: null } } };
const config = { mascot: { enabled: false, name: null, assetKey: null, messages: {} }, languages: ['en'], streakMilestones: [] };

const course = (id: string, title: string, subjectId: string | null, subjectName = 'Subject', lessons = 0): CatalogCourse => ({
  id, title, description: null, subjectId: subjectId ?? '', subject: subjectId ? { id: subjectId, name: subjectName, code: null, description: null } : null, _count: { lessons, videos: 0, sourceLibraryItems: 0 },
});

const LONG = ['Jain Theory of Karma Philosophy', 'Fundamentals of Jain Philosophy', 'Navkar–Jaap–Dhyan–Sadhana'];
const catalog = [
  course('c1', 'Chapter A', 'sub1', LONG[0], 2), course('c2', 'Chapter B', 'sub1', LONG[0]),
  course('c3', 'Chapter C', 'sub2', LONG[1]), course('c4', 'Chapter D', 'sub3', LONG[2]), course('c5', 'Orphan', null),
];

function setExperience(enabled: boolean) {
  useLearningExperience.setState(enabled ? { status: 'ready', enabled: true, config } : { status: 'ready', enabled: false, config: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockedUseAuth.mockReturnValue({ user: student, status: 'authenticated', login: jest.fn(), logout: jest.fn(async () => undefined), logoutAll: jest.fn() });
  api.catalogCourses.mockResolvedValue(catalog);
  api.courses.mockResolvedValue([]);
  api.courseLessons.mockResolvedValue([]);
  api.unreadCount.mockResolvedValue(0);
  work.listQuizzes.mockResolvedValue([]);
  work.listHomework.mockResolvedValue([]);
  api.tasks.mockResolvedValue([]);
});

// ---------------------------------------------------------------- pure mapping

test('subjects are grouped by the real Subject record; courses without one are not shown', () => {
  const groups = groupSubjects(catalog);
  expect(groups.map((group) => group.name)).toEqual([LONG[1], LONG[0], LONG[2]].sort((a, b) => a.localeCompare(b)));
  expect(groups.find((group) => group.id === 'sub1')?.chapters.map((chapter) => chapter.id)).toEqual(['c1', 'c2']);
  expect(groups.some((group) => group.chapters.some((chapter) => chapter.id === 'c5'))).toBe(false);
});

test('search filters displayed content only', () => {
  const groups = groupSubjects(catalog);
  expect(filterSubjects(groups, 'navkar')).toHaveLength(1);
  expect(filterSubjects(groups, 'chapter b')[0].id).toBe('sub1'); // matches through a chapter title
  expect(filterSubjects(groups, 'zzz')).toHaveLength(0);
  expect(filterChapters(groups[0].chapters, '')).toHaveLength(groups[0].chapters.length);
});

// ------------------------------------------------------------------ tenant

test('a standard school keeps the standard Learn screen and never requests the course catalogue', async () => {
  setExperience(false);
  expect((await render(<StudentLearnRoute />)).getByText('standard-ai-hub')).toBeTruthy();
  expect(api.catalogCourses).not.toHaveBeenCalled();
});

test('standard schools keep the original performance screen and are redirected away from institution-only screens', async () => {
  setExperience(false);
  expect((await render(<StudentPerformanceRoute />)).getByText('standard-performance')).toBeTruthy();
  expect((await render(<AcademicDetailsRoute />)).getByText('redirect:/(student)/performance')).toBeTruthy();
  expect(perf.getMyPerformance).not.toHaveBeenCalled();
});

// -------------------------------------------------------------------- Learn

test('the institution Learn screen shows real subjects, including long names, and opens a subject', async () => {
  setExperience(true);
  const screen = await render(<StudentLearnRoute />);
  await waitFor(() => expect(screen.getByText(LONG[0])).toBeTruthy());
  expect(screen.getByText(LONG[1])).toBeTruthy();
  expect(screen.getByText(LONG[2])).toBeTruthy();
  expect(screen.getByText('03 subjects')).toBeTruthy();
  expect(screen.getByText('Follow your curiosity.')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText(`${LONG[0]}. Open subject`)); });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(student)/learn-subject', params: { subjectId: 'sub1' } });
});

test('Learn never fabricates subjects: empty and error states are truthful and Notes stays disabled', async () => {
  setExperience(true);
  api.catalogCourses.mockResolvedValue([]);
  const empty = await render(<StudentLearnRoute />);
  await waitFor(() => expect(empty.getByText('No subjects yet')).toBeTruthy());
  expect(empty.getByLabelText('Notes. Not available yet').props.accessibilityState.disabled).toBe(true);
  await empty.unmount();
  api.catalogCourses.mockRejectedValue(new Error('offline'));
  const failed = await render(<StudentLearnRoute />);
  await waitFor(() => expect(failed.getByText('We couldn\'t load this')).toBeTruthy());
});

test('search narrows the displayed subjects', async () => {
  setExperience(true);
  const screen = await render(<StudentLearnRoute />);
  await waitFor(() => expect(screen.getByText(LONG[0])).toBeTruthy());
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Search'), 'navkar'); });
  expect(screen.queryByText(LONG[0])).toBeNull();
  expect(screen.getByText(LONG[2])).toBeTruthy();
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Search'), 'zzz'); });
  expect(screen.getByText('Nothing matches your search')).toBeTruthy();
});

// ------------------------------------------------------------ Subject / Chapter

test('Subject detail lists its chapters and only the quizzes linked to that subject', async () => {
  mockParams = { subjectId: 'sub1' };
  const quiz = (id: string, subjectId: string, title: string) => ({ id, subjectId, title, durationMinutes: 10, attempts: [], subject: null }) as never;
  work.listQuizzes.mockResolvedValue([quiz('q1', 'sub1', 'Karma quiz'), quiz('q2', 'sub2', 'Other subject quiz')]);
  const screen = await render(<SubjectDetailScreen />);
  await waitFor(() => expect(screen.getByText('Chapter A')).toBeTruthy());
  expect(screen.getByText('Chapter B')).toBeTruthy();
  expect(screen.queryByText('Chapter C')).toBeNull();
  await waitFor(() => expect(screen.getByText('Karma quiz')).toBeTruthy());
  expect(screen.queryByText('Other subject quiz')).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText('Chapter A')); });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(student)/learn-chapter', params: { courseId: 'c1' } });
  await act(async () => { fireEvent.press(screen.getByLabelText('Karma quiz')); });
  expect(mockPush).toHaveBeenCalledWith('/(student)/quiz/q1');
});

test('an unknown or not-authorised subject shows an empty state rather than another tenant\'s data', async () => {
  mockParams = { subjectId: 'not-mine' };
  const screen = await render(<SubjectDetailScreen />);
  await waitFor(() => expect(screen.getByText('Subject not available')).toBeTruthy());
});

test('Chapter detail shows lessons from the published learning course and opens the existing lesson screen', async () => {
  mockParams = { courseId: 'c1' };
  api.courses.mockResolvedValue([{ id: 'c1', title: 'Chapter A', description: null, lessonsOpened: 0, lessons: [{ id: 'l1', title: 'Lesson one', description: null, orderIndex: 1, opened: false }] }]);
  const screen = await render(<ChapterDetailScreen />);
  await waitFor(() => expect(screen.getByText('Lesson one')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByLabelText('Lesson one')); });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(student)/learning-lesson', params: { courseId: 'c1', lessonId: 'l1' } });
  // No resource is invented: reading material is shown as unavailable, never as an action.
  expect(screen.getByLabelText('Reading. Not available yet').props.accessibilityState.disabled).toBe(true);
});

test('a chapter outside the student\'s authorised catalogue is "not available" and never fetches lessons', async () => {
  await expect(loadChapter('other-tenant-course')).resolves.toBeNull();
  expect(api.courseLessons).not.toHaveBeenCalled();
  mockParams = { courseId: 'other-tenant-course' };
  const screen = await render(<ChapterDetailScreen />);
  await waitFor(() => expect(screen.getByText('Chapter not available')).toBeTruthy());
});

// -------------------------------------------------------------- navigation

test('the institution tab bar has exactly four tabs and no Notices tab', async () => {
  const navigate = jest.fn();
  const routes = ['index', 'learn', 'tasks', 'notices', 'profile'].map((name) => ({ key: `${name}-k`, name, params: undefined }));
  const props = { state: { index: 1, routes }, navigation: { emit: () => ({ defaultPrevented: false }), navigate } };
  const bar = await render(<VeralayamTabBar {...(props as unknown as React.ComponentProps<typeof VeralayamTabBar>)} />);
  expect(bar.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual(['Home', 'Learn', 'Tasks', 'Profile']);
  expect(bar.getByLabelText('Learn').props.accessibilityState.selected).toBe(true);
  await act(async () => { fireEvent.press(bar.getByLabelText('Tasks')); });
  expect(navigate).toHaveBeenCalledWith('tasks', undefined);
});

// ------------------------------------------------------------------- Tasks

test('daily task rows mirror the API state', () => {
  const base = { assignmentId: 'a', quizId: 'q', title: 'Daily quiz', durationMinutes: 10, assignedDate: '2026-10-19', dueAt: '2026-10-20T10:00:00Z', attemptId: null, submittedAt: null, result: null } as const;
  expect(dailyRow({ ...base, state: 'PENDING', overdue: true } as LearningTask)).toMatchObject({ badge: 'Overdue', tone: 'danger', attention: true, done: false, href: '/(student)/quiz/q' });
  expect(dailyRow({ ...base, state: 'SUBMITTED', overdue: true } as LearningTask)).toMatchObject({ badge: 'Submitted', meta: 'Result not released yet', attention: false, done: true });
  expect(dailyRow({ ...base, state: 'GRADED', overdue: false, attemptId: 'x' } as LearningTask)).toMatchObject({ badge: 'Result ready', done: true });
  expect(homeworkRow({ id: 'h', title: 'HW', subject: null, homeworkType: 'MIXED', questionCount: 1, totalMarks: null, dueDate: '2020-01-01', submissionStatus: 'NOT_SUBMITTED' } as never)).toMatchObject({ badge: 'Overdue', attention: true });
});

test('the institution Tasks screen shows the real pending daily quiz and an honest empty homework list', async () => {
  setExperience(true);
  api.tasks.mockResolvedValue([{ assignmentId: 'a1', quizId: 'q1', title: 'Daily quiz 1', durationMinutes: 10, assignedDate: '2026-10-19', dueAt: '2026-10-20T10:00:00Z', state: 'PENDING', overdue: false, attemptId: null, submittedAt: null, result: null }]);
  const screen = await render(<StudentTasksRoute />);
  await waitFor(() => expect(screen.getByText('Daily quiz 1')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByLabelText('Daily quiz 1')); });
  expect(mockPush).toHaveBeenCalledWith('/(student)/quiz/q1');
  await act(async () => { fireEvent.press(screen.getByLabelText('Homework')); });
  expect(screen.getByText('Nothing assigned yet')).toBeTruthy();
});

// ----------------------------------------------------------- Notifications

test('notifications split into Recent and Earlier by their real timestamps', () => {
  const now = Date.parse('2026-10-23T00:00:00Z');
  const item = (id: string, createdAt: string) => ({ id, createdAt }) as never;
  const { recent, earlier } = groupByRecency([item('a', '2026-10-22T00:00:00Z'), item('b', '2026-09-01T00:00:00Z')], now);
  expect(recent).toHaveLength(1);
  expect(earlier).toHaveLength(1);
});

// ---------------------------------------------------------------- Progress

test('the improvement plan only shows backend suggestions and shows an honest empty state otherwise', async () => {
  setExperience(true);
  const base = { insights: [], subjects: [], dataNotes: { scoredEvidence: '', percentages: '' } };
  perf.getMyPerformance.mockResolvedValue({ ...base, suggestions: [{ code: 'OVERDUE_HOMEWORK', basedOn: 'OVERDUE_HOMEWORK', text: 'Complete overdue homework' }] } as never);
  const screen = await render(<VeralayamImprovementPlan />);
  await waitFor(() => expect(screen.getByText('Complete overdue homework')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByLabelText('Complete overdue homework')); });
  expect(mockPush).toHaveBeenCalledWith('/(student)/(tabs)/tasks');
  await screen.unmount();
  perf.getMyPerformance.mockResolvedValue({ ...base, suggestions: [] } as never);
  const empty = await render(<VeralayamImprovementPlan />);
  await waitFor(() => expect(empty.getByText('No suggestions right now')).toBeTruthy());
});

// ----------------------------------------------------------------- Profile

test('the profile shows the authenticated learner only and points to the supported recovery path', async () => {
  setExperience(true);
  api.home.mockResolvedValue({ learner: { fullName: 'Asha Patel', organizationName: 'Test Institute', className: '8 A' }, mascot: { enabled: false, reduceAnimations: false } } as never);
  expect(initialsOf('Asha Patel')).toBe('AP');
  expect(initialsOf('')).toBe('?');
  const screen = await render(<VeralayamProfile />);
  expect(screen.getByText('Asha Patel')).toBeTruthy();
  expect(screen.getByText('Test Institute')).toBeTruthy();
  expect(screen.getByText('asha@example.test')).toBeTruthy();
  expect(screen.queryByText(/Nayan/)).toBeNull();
  expect(screen.getByText(/Ask your institution administrator for a new activation link/)).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText('Change password')); });
  expect(mockPush).toHaveBeenCalledWith('/(student)/change-password');
});
