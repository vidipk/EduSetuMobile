import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import StudentTasksScreen from '@/app/(student)/(tabs)/tasks';
import { studentWorkApi } from '@/api/academics/student-work';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = require('react');
    useEffect(callback, [callback]);
  },
}));

jest.mock('lucide-react-native', () => ({
  BookOpenCheck: () => null,
  ClipboardList: () => null,
}));

jest.mock('@/api/academics/student-work', () => ({
  studentWorkApi: {
    listQuizzes: jest.fn(),
    listHomework: jest.fn(),
  },
}));

const mockedApi = jest.mocked(studentWorkApi);

const quiz = {
  id: 'quiz-1',
  organizationId: 'org-1',
  teacherId: 'teacher-1',
  classId: 'class-1',
  sectionId: 'section-1',
  subjectId: 'subject-1',
  title: 'Fractions Quiz',
  description: null,
  totalMarks: 20,
  durationMinutes: 30,
  status: 'PUBLISHED' as const,
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
  subject: { id: 'subject-1', name: 'Math' },
  attempts: [],
};

const homework = {
  id: 'homework-1',
  title: 'Algebra Practice',
  subject: { id: 'subject-1', name: 'Math' },
  homeworkType: 'OBJECTIVE' as const,
  questionCount: 5,
  totalMarks: 10,
  dueDate: '2026-10-20T00:00:00.000Z',
  submissionStatus: 'NOT_SUBMITTED' as const,
};

beforeEach(() => {
  mockPush.mockClear();
  mockedApi.listQuizzes.mockResolvedValue([quiz]);
  mockedApi.listHomework.mockResolvedValue([homework]);
});

test('renders assigned quizzes without teacher-only answers', async () => {
  const view = await render(<StudentTasksScreen />);

  await waitFor(() => expect(view.getByText('Fractions Quiz')).toBeTruthy());
  expect(view.getByText('Math')).toBeTruthy();
  expect(view.getByText('Not started')).toBeTruthy();
  expect(view.queryByText(/correct answer/i)).toBeNull();
});

test('renders assigned homework after switching tabs', async () => {
  const view = await render(<StudentTasksScreen />);

  await waitFor(() => expect(view.getByRole('button', { name: /Homework 1/i })).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByRole('button', { name: /Homework 1/i })); });

  await waitFor(() => expect(view.getByText('Algebra Practice')).toBeTruthy());
  expect(view.getByText('Deadline')).toBeTruthy();
  expect(view.getByText('Questions')).toBeTruthy();
});

test('shows an empty state for empty results', async () => {
  mockedApi.listQuizzes.mockResolvedValue([]);
  mockedApi.listHomework.mockResolvedValue([]);

  const view = await render(<StudentTasksScreen />);

  await waitFor(() => expect(view.getByText('No quizzes assigned')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByRole('button', { name: /Homework 0/i })); });
  await waitFor(() => expect(view.getByText('No homework assigned')).toBeTruthy());
});

test('shows retry for API failures', async () => {
  mockedApi.listQuizzes.mockRejectedValueOnce(new Error('Network unavailable'));

  const view = await render(<StudentTasksScreen />);

  await waitFor(() => expect(view.getByText('Network unavailable')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Retry' })); });
  await waitFor(() => expect(mockedApi.listQuizzes).toHaveBeenCalledTimes(2));
});

test('navigates to assignment details', async () => {
  const view = await render(<StudentTasksScreen />);

  await waitFor(() => expect(view.getByRole('button', { name: /Fractions Quiz/i })).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByRole('button', { name: /Fractions Quiz/i })); });
  expect(mockPush).toHaveBeenCalledWith('/(student)/quiz/quiz-1');

  await act(async () => { fireEvent.press(view.getByRole('button', { name: /Homework 1/i })); });
  await waitFor(() => expect(view.getByRole('button', { name: /Algebra Practice/i })).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByRole('button', { name: /Algebra Practice/i })); });
  expect(mockPush).toHaveBeenCalledWith('/(student)/homework/homework-1');
});
const mockPush = jest.mocked(require('expo-router').router.push);

