import { attendanceApi, cleanParams, homeworkApi, quizApi, teacherProfileApi } from '@/api/academics/teacher-ops';
import { apiClient } from '@/api/client';

jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

const client = jest.mocked(apiClient);

beforeEach(() => {
  Object.values(client).forEach((fn) => (fn as jest.Mock).mockReset());
  client.get.mockResolvedValue({ data: { ok: true } });
  client.post.mockResolvedValue({ data: { id: 'x' } });
  client.patch.mockResolvedValue({ data: { id: 'x' } });
  client.delete.mockResolvedValue({ data: null });
});

test('params drop empty values and cap page size at the backend limit', () => {
  expect(cleanParams({ a: 'x', b: '', c: undefined, d: null, limit: 500, page: 2, flag: false })).toEqual({ a: 'x', limit: 100, page: 2, flag: false });
});

test('profile and attendance endpoints', async () => {
  await teacherProfileApi.get();
  await attendanceApi.getRoster({ classId: 'c', sectionId: 's', date: '2026-10-14', academicYearId: 'y' });
  await attendanceApi.createSession({ classId: 'c', sectionId: 's', date: '2026-10-14' });
  await attendanceApi.saveRecords('sess/1', [{ studentId: 'a', status: 'ABSENT' }]);
  await attendanceApi.submit('sess/1');
  await attendanceApi.list({ status: 'DRAFT', date: '2026-10-14', limit: 20, page: 1 });
  await attendanceApi.get('sess-1');
  expect(client.get).toHaveBeenNthCalledWith(1, '/teachers/me/profile');
  expect(client.get).toHaveBeenNthCalledWith(2, '/attendance/roster', { params: { classId: 'c', sectionId: 's', date: '2026-10-14', academicYearId: 'y' } });
  expect(client.post).toHaveBeenNthCalledWith(1, '/attendance/sessions', { classId: 'c', sectionId: 's', date: '2026-10-14' });
  expect(client.post).toHaveBeenNthCalledWith(2, '/attendance/sessions/sess%2F1/records', { records: [{ studentId: 'a', status: 'ABSENT' }] });
  expect(client.patch).toHaveBeenCalledWith('/attendance/sessions/sess%2F1/submit');
  expect(client.get).toHaveBeenCalledWith('/attendance/sessions', { params: { status: 'DRAFT', date: '2026-10-14', limit: 20, page: 1 } });
  expect(client.get).toHaveBeenCalledWith('/attendance/sessions/sess-1');
});

test('homework endpoints never send a teacher id and use the documented routes', async () => {
  const body = { classId: 'c', sectionId: 's', subjectId: 'm', title: 'T', homeworkType: 'SUBJECTIVE' as const, totalMarks: 5, dueDate: '2026-12-01T00:00:00.000Z', questions: [] };
  await homeworkApi.list({ status: 'PUBLISHED', classId: 'c' });
  await homeworkApi.get('h1');
  await homeworkApi.create(body);
  await homeworkApi.update('h1', body);
  await homeworkApi.publish('h1');
  await homeworkApi.remove('h1');
  await homeworkApi.submissions('h1');
  await homeworkApi.grade('sub1', { marks: 4, feedback: 'ok' });
  expect(client.get).toHaveBeenCalledWith('/homework', { params: { status: 'PUBLISHED', classId: 'c' } });
  expect(client.post).toHaveBeenCalledWith('/homework', body);
  expect(JSON.stringify(client.post.mock.calls[0][1])).not.toMatch(/teacherId/);
  expect(client.patch).toHaveBeenCalledWith('/homework/h1', body);
  expect(client.patch).toHaveBeenCalledWith('/homework/h1/publish');
  expect(client.delete).toHaveBeenCalledWith('/homework/h1');
  expect(client.get).toHaveBeenCalledWith('/homework/h1/submissions');
  expect(client.patch).toHaveBeenCalledWith('/homework/submissions/sub1/grade', { marks: 4, feedback: 'ok' });
});

test('quiz endpoints', async () => {
  await quizApi.list({ status: 'DRAFT' });
  await quizApi.create({ classId: 'c', sectionId: 's', subjectId: 'm', title: 'Q', totalMarks: 10, durationMinutes: 20 });
  await quizApi.update('q1', { totalMarks: 9 });
  await quizApi.publish('q1');
  await quizApi.addQuestion('q1', { questionText: 'x', questionType: 'SHORT_ANSWER', marks: 2, orderIndex: 1 });
  await quizApi.updateQuestion('qq1', { marks: 3 });
  await quizApi.removeQuestion('qq1');
  await quizApi.attempts('q1', { gradingStatus: 'PENDING_REVIEW', studentSearch: 'as', page: 2, limit: 20 });
  await quizApi.review('a1');
  await quizApi.grade('a1', { answers: [{ answerId: 'x', awardedMarks: 2 }], finalize: true });
  await quizApi.remove('q1');
  expect(client.patch).toHaveBeenCalledWith('/quizzes/q1', { totalMarks: 9 });
  expect(client.patch).toHaveBeenCalledWith('/quizzes/q1/publish');
  expect(client.post).toHaveBeenCalledWith('/quizzes/q1/questions', expect.objectContaining({ orderIndex: 1 }));
  expect(client.patch).toHaveBeenCalledWith('/quiz-questions/qq1', { marks: 3 });
  expect(client.delete).toHaveBeenCalledWith('/quiz-questions/qq1');
  expect(client.get).toHaveBeenCalledWith('/quizzes/q1/attempts', { params: { gradingStatus: 'PENDING_REVIEW', studentSearch: 'as', page: 2, limit: 20 } });
  expect(client.get).toHaveBeenCalledWith('/quiz-attempts/a1/review');
  expect(client.patch).toHaveBeenCalledWith('/quiz-attempts/a1/grade', { answers: [{ answerId: 'x', awardedMarks: 2 }], finalize: true });
  expect(client.delete).toHaveBeenCalledWith('/quizzes/q1');
});
