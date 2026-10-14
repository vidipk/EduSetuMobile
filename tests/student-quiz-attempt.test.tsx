import { fireEvent, render, waitFor } from '@testing-library/react-native';

import StudentQuizDetailScreen from '@/app/(student)/quiz/[quizId]';
import { studentWorkApi } from '@/api/academics/student-work';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ quizId: 'quiz-1' }),
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = require('react');
    useEffect(callback, [callback]);
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('lucide-react-native', () => ({
  Eye: () => null,
  EyeOff: () => null,
  Search: () => null,
}));

jest.mock('@/api/academics/student-work', () => ({
  studentWorkApi: {
    getQuiz: jest.fn(),
    listQuizzes: jest.fn(),
    startQuiz: jest.fn(),
    submitQuizAttempt: jest.fn(),
    getQuizAttemptResult: jest.fn(),
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
  description: 'Teacher AI draft: correct answer is hidden',
  totalMarks: 2,
  durationMinutes: 10,
  status: 'PUBLISHED' as const,
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
  subject: { id: 'subject-1', name: 'Math' },
  attempts: [],
  questions: [
    {
      id: 'q1',
      questionText: 'What is one half of 2?',
      questionType: 'MCQ',
      options: [{ id: 'o1', text: '1' }, { id: 'o2', text: '2' }],
      marks: 1,
      orderIndex: 0,
      configurationError: null,
    },
  ],
};

beforeEach(() => {
  mockedApi.getQuiz.mockResolvedValue(quiz);
  mockedApi.listQuizzes.mockResolvedValue([quiz]);
  mockedApi.startQuiz.mockResolvedValue({ id: 'attempt-1', status: 'IN_PROGRESS', score: null, autoScore: null, gradingStatus: 'NOT_REQUIRED', submittedAt: null });
  mockedApi.submitQuizAttempt.mockResolvedValue({ attempt: { id: 'attempt-1', status: 'SUBMITTED', score: null, autoScore: null, gradingStatus: 'PENDING_REVIEW', submittedAt: '2026-10-14T10:00:00.000Z' } });
  mockedApi.getQuizAttemptResult.mockResolvedValue({ attempt: { id: 'attempt-1', status: 'SUBMITTED', score: null, autoScore: null, gradingStatus: 'PENDING_REVIEW', submittedAt: '2026-10-14T10:00:00.000Z' } });
});

test('starts, answers, reviews and submits a quiz without showing teacher-only answers', async () => {
  const view = await render(<StudentQuizDetailScreen />);

  await waitFor(() => expect(view.getByText('Fractions Quiz')).toBeTruthy());
  expect(view.queryByText(/correct answer is hidden/i)).toBeNull();

  fireEvent.press(view.getByRole('button', { name: 'Start quiz' }));
  await waitFor(() => expect(mockedApi.startQuiz).toHaveBeenCalledWith('quiz-1'));

  fireEvent.press(view.getAllByRole('radio')[0]);
  await waitFor(() => expect(view.getByText('1/1 answered')).toBeTruthy());
  fireEvent.press(view.getByRole('button', { name: 'Review' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Submit quiz' })).toBeTruthy());
  fireEvent.press(view.getByRole('button', { name: 'Submit quiz' }));

  await waitFor(() => expect(mockedApi.submitQuizAttempt).toHaveBeenCalledWith('attempt-1', { answers: { q1: 'o1' } }));
  await waitFor(() => expect(view.getAllByText('Awaiting review').length).toBeGreaterThan(0));
});
