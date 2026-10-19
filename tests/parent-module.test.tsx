import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { parentApi } from '@/api/academics/parent';
import { performanceApi } from '@/api/academics/performance';
import { apiClient } from '@/api/client';
import { AppApiError } from '@/api/client/error';
import type { ParentAttendanceResponse, ParentHomeworkItem, ParentNotice, ParentQuizResultItem } from '@/api/contracts/parent';
import type { ParentChild } from '@/api/contracts/performance';
import { ParentAttendanceScreen, ParentDashboardScreen, ParentHomeworkScreen, ParentNoticesScreen, ParentQuizzesScreen } from '@/features/parent/ParentScreens';
import { useParentContext } from '@/stores/parent-context';

import { richPerformance } from './fixtures/performance';

let mockUser: { id: string; role: string } | null = { id: 'parent-1', role: 'PARENT' };

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('lucide-react-native', () => ({ Eye: () => null, EyeOff: () => null, Search: () => null }));
jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/api/academics/performance', () => ({ performanceApi: { getChildPerformance: jest.fn(), listChildren: jest.fn() } }));
jest.mock('@/api/academics/parent', () => {
  const actual = jest.requireActual('@/api/academics/parent');
  return { parentApi: { ...actual.parentApi, attendance: jest.fn(), homework: jest.fn(), quizResults: jest.fn(), notices: jest.fn(), notice: jest.fn() } };
});

const perf = jest.mocked(performanceApi);
const api = jest.mocked(parentApi);

const child = (id: string, name: string): ParentChild => ({
  studentProfileId: id, name, avatarUrl: null, studentCode: id, admissionNumber: id, rollNumber: null, relation: 'Mother', isPrimary: false,
  class: { id: 'c1', name: 'Class 8' }, section: { id: 'sec1', name: 'A' }, academicYear: { id: 'y1', name: '2026-27' },
});

const attendanceFor = (id: string, name: string, summary: ParentAttendanceResponse['summary']): ParentAttendanceResponse => ({
  items: summary.total ? [{ id: `r-${id}`, date: '2026-10-01T00:00:00.000Z', status: 'PRESENT', remarks: null, subject: null }] : [],
  meta: { page: 1, limit: 31, total: summary.total, totalPages: 1 },
  child: { studentProfileId: id, name, class: { id: 'c1', name: 'Class 8' }, section: { id: 'sec1', name: 'A' } },
  summary,
} as ParentAttendanceResponse);

beforeEach(() => {
  mockUser = { id: 'parent-1', role: 'PARENT' };
  useParentContext.getState().reset();
  for (const fn of [perf.getChildPerformance, perf.listChildren, api.attendance, api.homework, api.quizResults, api.notices, api.notice]) (fn as jest.Mock).mockReset();
  api.notices.mockResolvedValue({ items: [], meta: { page: 1, limit: 15, total: 0, totalPages: 0 } } as never);
});

test('one child: dashboard shows the child, performance tiles and no child switcher', async () => {
  perf.listChildren.mockResolvedValue([child('s1', 'Asha Rao')]);
  perf.getChildPerformance.mockResolvedValue(richPerformance());
  const view = await render(<ParentDashboardScreen />);
  await waitFor(() => expect(view.getByLabelText('Showing Asha Rao')).toBeTruthy());
  await waitFor(() => expect(view.getByText('Homework completion')).toBeTruthy());
  expect(view.queryByText('Child')).toBeNull();
  expect(perf.getChildPerformance).toHaveBeenCalledWith('s1');
  expect(view.getByText(/Scores include only released quiz results/)).toBeTruthy();
});

test('no linked children shows an empty state and fetches nothing else', async () => {
  perf.listChildren.mockResolvedValue([]);
  const view = await render(<ParentDashboardScreen />);
  await waitFor(() => expect(view.getByText('No linked children')).toBeTruthy());
  expect(perf.getChildPerformance).not.toHaveBeenCalled();
});

test('multiple children: switching never shows the previous child data', async () => {
  perf.listChildren.mockResolvedValue([child('s1', 'Asha Rao'), child('s2', 'Ben Rao')]);
  api.attendance.mockImplementation(async (id) => (id === 's1' ? attendanceFor('s1', 'Asha Rao', { total: 10, present: 9, absent: 1, attendancePercentage: 90 }) : attendanceFor('s2', 'Ben Rao', { total: 0, present: 0, absent: 0, attendancePercentage: 0 })));
  const view = await render(<ParentAttendanceScreen />);
  await waitFor(() => expect(view.getByText('90%')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('Ben Rao')); });
  await waitFor(() => expect(view.getByText('No attendance recorded')).toBeTruthy());
  expect(view.queryByText('90%')).toBeNull();
  expect(api.attendance).toHaveBeenCalledWith('s2', expect.anything());
});

test('attendance is read-only: no edit or draft controls and a zero total is not 0%', async () => {
  perf.listChildren.mockResolvedValue([child('s1', 'Asha Rao')]);
  api.attendance.mockResolvedValue(attendanceFor('s1', 'Asha Rao', { total: 0, present: 0, absent: 0, attendancePercentage: 0 }));
  const view = await render(<ParentAttendanceScreen />);
  await waitFor(() => expect(view.getByText('No attendance recorded')).toBeTruthy());
  expect(view.queryByText('0%')).toBeNull();
  expect(view.queryByRole('button', { name: /edit|save|submit|draft/i })).toBeNull();
  expect(view.queryByRole('switch')).toBeNull();
});

test('an invalid attendance date range is rejected before any request is made', async () => {
  await expect(jest.requireActual('@/api/academics/parent').parentApi.attendance('s1', { from: '2026-10-10', to: '2026-10-01' })).rejects.toMatchObject({ code: 'INVALID_PERIOD' });
  expect(apiClient.get).not.toHaveBeenCalled();
});

test('homework shows released marks and feedback only for reviewed work', async () => {
  perf.listChildren.mockResolvedValue([child('s1', 'Asha Rao')]);
  const base = { dueDate: '2099-01-01T00:00:00.000Z', publishedAt: null, status: 'PUBLISHED', homeworkType: 'SUBJECTIVE', totalMarks: 10, subject: { id: 'm', name: 'Math' } } as const;
  const items: ParentHomeworkItem[] = [
    { ...base, id: 'h1', title: 'Fractions', submissionStatus: 'GRADED', submission: { id: 'x', submittedAt: '2026-10-01T00:00:00.000Z', gradedAt: '2026-10-02T00:00:00.000Z', marks: 8, feedback: 'Well done' } },
    { ...base, id: 'h2', title: 'Decimals', submissionStatus: 'NOT_SUBMITTED', submission: null },
  ];
  api.homework.mockResolvedValue({ items, meta: { page: 1, limit: 20, total: 2, totalPages: 1 } } as never);
  const view = await render(<ParentHomeworkScreen />);
  await waitFor(() => expect(view.getByText('Fractions')).toBeTruthy());
  expect(view.getByText('Marks: 8 / 10')).toBeTruthy();
  expect(view.getByLabelText('Teacher feedback')).toBeTruthy();
  expect(view.getByText('Decimals')).toBeTruthy();
});

test('quizzes never display scores for results that are not published', async () => {
  perf.listChildren.mockResolvedValue([child('s1', 'Asha Rao')]);
  perf.getChildPerformance.mockResolvedValue(richPerformance());
  const items: ParentQuizResultItem[] = [
    { attemptId: 'a1', status: 'SUBMITTED', gradingStatus: 'PENDING', score: null, maxScore: null, percentage: null, submittedAt: '2026-10-01T00:00:00.000Z', gradedAt: null, resultPublishedAt: null, quiz: { id: 'q1', title: 'Unit Test', subject: { id: 'm', name: 'Math' } } },
  ];
  api.quizResults.mockResolvedValue({ items: items.map((item) => ({ ...item, id: item.attemptId })), meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } as never);
  const view = await render(<ParentQuizzesScreen />);
  await waitFor(() => expect(view.getByText('Unit Test')).toBeTruthy());
  expect(view.queryByText(/correct answer/i)).toBeNull();
  expect(view.queryByText(/\d+ ?\/ ?\d+/)).toBeNull();
});

test('notices list loads for the selected child scope', async () => {
  perf.listChildren.mockResolvedValue([child('s1', 'Asha Rao'), child('s2', 'Ben Rao')]);
  const notice: ParentNotice = {
    id: 'n1', academicYearId: 'y1', type: 'GENERAL', status: 'PUBLISHED', title: 'Sports day', body: 'Bring kit', relatedResourceType: null, publishedAt: '2026-10-01T00:00:00.000Z', archivedAt: null, createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: { id: 't', fullName: 'Ms Rao', role: 'TEACHER' }, academicYear: { id: 'y1', name: '2026-27' }, forChildren: [{ studentProfileId: 's1', name: 'Asha Rao' }],
  };
  api.notices.mockResolvedValue({ items: [notice], meta: { page: 1, limit: 15, total: 1, totalPages: 1 } } as never);
  const view = await render(<ParentNoticesScreen />);
  await waitFor(() => expect(view.getByText('Sports day')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getAllByText('Ben Rao')[0]); });
  await waitFor(() => expect(api.notices).toHaveBeenCalledWith(expect.objectContaining({ studentProfileId: 's2' })));
});

test('a child that is no longer authorized shows a safe message', async () => {
  perf.listChildren.mockResolvedValue([child('s1', 'Asha Rao')]);
  perf.getChildPerformance.mockRejectedValue(new AppApiError('Forbidden', 403, 'FORBIDDEN'));
  const view = await render(<ParentDashboardScreen />);
  await waitFor(() => expect(view.getByText('This child is no longer available on your account.')).toBeTruthy());
});
