import { studentWorkApi } from '@/api/academics/student-work';
import { apiClient } from '@/api/client';
import { homeworkStatus, quizStatus } from '@/app/(student)/work-utils';

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedClient = jest.mocked(apiClient);

beforeEach(() => {
  mockedClient.get.mockReset();
  mockedClient.post.mockReset();
});

test('uses student-scoped quiz endpoint', async () => {
  mockedClient.get.mockResolvedValueOnce({ data: [{ id: 'quiz-1' }] });

  await expect(studentWorkApi.listQuizzes()).resolves.toEqual([{ id: 'quiz-1' }]);
  expect(mockedClient.get).toHaveBeenCalledWith('/students/me/quizzes');
});

test('uses student-scoped homework endpoint', async () => {
  mockedClient.get.mockResolvedValueOnce({ data: [{ id: 'homework-1' }] });

  await expect(studentWorkApi.listHomework()).resolves.toEqual([{ id: 'homework-1' }]);
  expect(mockedClient.get).toHaveBeenCalledWith('/students/me/homework');
});

test('uses existing quiz attempt endpoints', async () => {
  mockedClient.post.mockResolvedValueOnce({ data: { id: 'attempt-1' } });
  mockedClient.post.mockResolvedValueOnce({ data: { attempt: { id: 'attempt-1' } } });
  mockedClient.get.mockResolvedValueOnce({ data: { attempt: { id: 'attempt-1' } } });

  await expect(studentWorkApi.startQuiz('quiz-1')).resolves.toEqual({ id: 'attempt-1' });
  await expect(studentWorkApi.submitQuizAttempt('attempt-1', { answers: { q1: 'o1', q2: true } })).resolves.toEqual({ attempt: { id: 'attempt-1' } });
  await expect(studentWorkApi.getQuizAttemptResult('attempt-1')).resolves.toEqual({ attempt: { id: 'attempt-1' } });

  expect(mockedClient.post).toHaveBeenNthCalledWith(1, '/quizzes/quiz-1/start');
  expect(mockedClient.post).toHaveBeenNthCalledWith(2, '/quiz-attempts/attempt-1/submit', { answers: { q1: 'o1', q2: true } });
  expect(mockedClient.get).toHaveBeenCalledWith('/quiz-attempts/attempt-1/result');
});

test('maps quiz status from actual attempt fields', () => {
  expect(quizStatus({ attempts: [] } as never)).toEqual({ label: 'Not started', tone: 'info' });
  expect(quizStatus({ attempts: [{ status: 'SUBMITTED', gradingStatus: 'PENDING_REVIEW' }] } as never)).toEqual({ label: 'Awaiting review', tone: 'warning' });
  expect(quizStatus({ attempts: [{ status: 'EVALUATED', gradingStatus: 'GRADED' }] } as never)).toEqual({ label: 'Result released', tone: 'success' });
});

test('maps homework deadline and submission status', () => {
  const now = new Date('2026-10-14T12:00:00.000Z');
  expect(homeworkStatus({ dueDate: '2026-10-13T00:00:00.000Z', submissionStatus: 'NOT_SUBMITTED' } as never, now)).toEqual({ label: 'Overdue', tone: 'danger' });
  expect(homeworkStatus({ dueDate: '2026-10-15T00:00:00.000Z', submissionStatus: 'NOT_SUBMITTED' } as never, now)).toEqual({ label: 'Due soon', tone: 'warning' });
  expect(homeworkStatus({ dueDate: '2026-10-20T00:00:00.000Z', submissionStatus: 'GRADED' } as never, now)).toEqual({ label: 'Graded', tone: 'success' });
});
