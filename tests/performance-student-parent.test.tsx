import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { performanceApi } from '@/api/academics/performance';
import { AppApiError } from '@/api/client/error';
import type { ParentChild, StudentPerformance } from '@/api/contracts/performance';
import MyPerformanceScreen from '@/features/performance/MyPerformanceScreen';
import ParentPerformanceScreen from '@/features/performance/ParentPerformanceScreen';
import { emptyPerformance, richPerformance } from './fixtures/performance';

let mockUser: { id: string; role: string } | null = { id: 'user-1', role: 'STUDENT' };

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('lucide-react-native', () => ({ Eye: () => null, EyeOff: () => null, Search: () => null }));
jest.mock('@/api/academics/performance', () => ({
  performanceApi: { getMyPerformance: jest.fn(), getChildPerformance: jest.fn(), listChildren: jest.fn() },
}));

const api = jest.mocked(performanceApi);

const child = (id: string, name: string, extra: Partial<ParentChild> = {}): ParentChild => ({
  studentProfileId: id, name, avatarUrl: null, studentCode: id, admissionNumber: id, rollNumber: null, relation: 'Mother', isPrimary: false,
  class: { id: 'c1', name: 'Class 8' }, section: { id: 'sec1', name: 'A' }, academicYear: { id: 'y1', name: '2026-27' }, ...extra,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockUser = { id: 'user-1', role: 'STUDENT' };
  api.getMyPerformance.mockReset();
  api.getChildPerformance.mockReset();
  api.listChildren.mockReset();
});

// ------------------------------------------------------------------ student

test('student: loads authorized performance with released scores, attendance and counts', async () => {
  api.getMyPerformance.mockResolvedValue(richPerformance());
  const view = await render(<MyPerformanceScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  expect(api.getMyPerformance).toHaveBeenCalledWith({ subjectId: undefined });
  expect(view.getByLabelText('Quiz average: 70%')).toBeTruthy();
  expect(view.getByLabelText('Homework average: 90%')).toBeTruthy();
  expect(view.getByLabelText('Attendance: 90%')).toBeTruthy();
  expect(view.getByText('14 of 20 marks across 2 items')).toBeTruthy();
  expect(view.getByText('18 of 20 sessions present')).toBeTruthy();
  // Pending review is a count, not a score.
  expect(view.getByText('Awaiting results')).toBeTruthy();
  expect(view.getByText('Awaiting grading')).toBeTruthy();
  expect(view.getByText('Past due, not submitted')).toBeTruthy();
  // Rules-based, never presented as AI.
  expect(view.getByText(/not AI-generated/i)).toBeTruthy();
  expect(view.queryByText(/AI-powered|AI insight/i)).toBeNull();
});

test('student: null scores show "Not enough data yet", never 0%', async () => {
  api.getMyPerformance.mockResolvedValue(emptyPerformance());
  const view = await render(<MyPerformanceScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  expect(view.queryByText('0%')).toBeNull();
  expect(view.getByLabelText('Overall score: Not enough data yet')).toBeTruthy();
  expect(view.getByLabelText('Attendance: Not enough data yet')).toBeTruthy();
  expect(view.getByText(/No quizzes, homework or attendance have been recorded/)).toBeTruthy();
  expect(view.getByText(/no attendance sessions were recorded/)).toBeTruthy();
  expect(view.queryByText('Topics')).toBeNull();
  expect(view.queryByText('Practice')).toBeNull();
});

test('student: pending review with no released score keeps the average empty', async () => {
  const base = emptyPerformance();
  api.getMyPerformance.mockResolvedValue(emptyPerformance({ quizzes: { ...base.quizzes, assigned: 2, submitted: 2, pendingReview: 2 } }));
  const view = await render(<MyPerformanceScreen />);
  await waitFor(() => expect(view.getByText('Awaiting results')).toBeTruthy());
  expect(view.getByLabelText('Quiz average: Not enough data yet')).toBeTruthy();
});

test('student: insights show message, evidence and suggestion; insufficient data is labelled', async () => {
  api.getMyPerformance.mockResolvedValue(richPerformance());
  const view = await render(<MyPerformanceScreen />);
  await waitFor(() => expect(view.getByText('Areas to review')).toBeTruthy());
  expect(view.getByText('Learning insights')).toBeTruthy();
  expect(view.getByText('Suggested next steps')).toBeTruthy();
  expect(view.getByText('Mathematics: released scores average 40% across 3 graded items.')).toBeTruthy();
  expect(view.getByText('Graded items')).toBeTruthy();
  expect(view.getByText('Review threshold')).toBeTruthy();
  expect(view.getByText(/Fractions worksheet \(Mathematics\) was due/)).toBeTruthy();
  expect(view.getByText(/Based on: Mathematics: released scores/)).toBeTruthy();
  expect(view.getAllByText('Not enough data yet').length).toBeGreaterThan(0);
  expect(view.getByText(/Only 3 attendance session/)).toBeTruthy();
});

test('student: truncation warning is visible', async () => {
  const base = emptyPerformance();
  api.getMyPerformance.mockResolvedValue(emptyPerformance({ dataNotes: { ...base.dataNotes, truncatedAssessments: true } }));
  const view = await render(<MyPerformanceScreen />);
  await waitFor(() => expect(view.getByText(/Incomplete data/)).toBeTruthy());
});

test('student: network error shows a message and Retry reloads', async () => {
  api.getMyPerformance.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue(richPerformance());
  const view = await render(<MyPerformanceScreen />);
  await waitFor(() => expect(view.getByText(/Could not reach EduSetu/)).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  expect(api.getMyPerformance).toHaveBeenCalledTimes(2);
});

test('student: expired session shows a sign-in message without a retry loop', async () => {
  api.getMyPerformance.mockRejectedValue(new AppApiError('Unauthorized', 401));
  const view = await render(<MyPerformanceScreen />);
  await waitFor(() => expect(view.getByText(/session has expired/i)).toBeTruthy());
  expect(view.queryByRole('button', { name: 'Retry' })).toBeNull();
});

test('student: pull-to-refresh reloads data', async () => {
  api.getMyPerformance.mockResolvedValue(richPerformance());
  const view = await render(<MyPerformanceScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  await act(async () => { fireEvent(view.getByTestId('performance-scroll'), 'refresh'); });
  await waitFor(() => expect(api.getMyPerformance).toHaveBeenCalledTimes(2));
  expect(view.getByText('Asha Rao')).toBeTruthy();
});

test('student: period preset sends a valid from/to range', async () => {
  api.getMyPerformance.mockResolvedValue(richPerformance());
  const view = await render(<MyPerformanceScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('Period: Last 30 days'));
  await waitFor(() => expect(api.getMyPerformance).toHaveBeenCalledTimes(2));
  const query = api.getMyPerformance.mock.calls[1][0] as { from: string; to: string };
  expect(query.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(query.to >= query.from).toBe(true);
});

test('logged-out users never trigger a request or see data', async () => {
  mockUser = null;
  const view = await render(<MyPerformanceScreen />);
  expect(api.getMyPerformance).not.toHaveBeenCalled();
  expect(view.queryByText('Asha Rao')).toBeNull();
});

// ------------------------------------------------------------------- parent

test('parent: a single child is loaded from the authorized list', async () => {
  mockUser = { id: 'parent-1', role: 'PARENT' };
  api.listChildren.mockResolvedValue([child('s1', 'Asha Rao')]);
  api.getChildPerformance.mockResolvedValue(richPerformance());
  const view = await render(<ParentPerformanceScreen />);
  await waitFor(() => expect(view.getByLabelText('Attendance: 90%')).toBeTruthy());
  expect(api.getChildPerformance).toHaveBeenCalledWith('s1', { subjectId: undefined });
  expect(view.queryByLabelText('Child: Asha Rao')).toBeNull(); // no selector for one child
});

test('parent: no linked children shows an empty state and requests nothing', async () => {
  mockUser = { id: 'parent-1', role: 'PARENT' };
  api.listChildren.mockResolvedValue([]);
  const view = await render(<ParentPerformanceScreen />);
  await waitFor(() => expect(view.getByText('No linked children')).toBeTruthy());
  expect(api.getChildPerformance).not.toHaveBeenCalled();
});

test('parent: switching children never shows one child under another name', async () => {
  mockUser = { id: 'parent-1', role: 'PARENT' };
  api.listChildren.mockResolvedValue([child('s1', 'Asha Rao', { isPrimary: true }), child('s2', 'Ben Rao')]);
  const slow = deferred<StudentPerformance>();
  api.getChildPerformance.mockImplementation(async (id: string) => {
    if (id === 's1') return richPerformance();
    return slow.promise;
  });
  const view = await render(<ParentPerformanceScreen />);
  await waitFor(() => expect(view.getByLabelText('Attendance: 90%')).toBeTruthy());

  await fireEvent.press(view.getByLabelText('Child: Ben Rao'));
  await waitFor(() => expect(api.getChildPerformance).toHaveBeenCalledWith('s2', { subjectId: undefined }));
  // While Ben's data is loading, Asha's numbers are gone.
  expect(view.queryByLabelText('Attendance: 90%')).toBeNull();
  expect(view.getAllByText('Ben Rao').length).toBeGreaterThan(0);

  // Switch back before Ben's response arrives, then let the late response land.
  await fireEvent.press(view.getByLabelText('Child: Asha Rao'));
  await waitFor(() => expect(view.getByLabelText('Attendance: 90%')).toBeTruthy());
  await act(async () => { slow.resolve(richPerformance({ student: { ...emptyPerformance().student, studentProfileId: 's2', name: 'Ben Rao' } })); });
  expect(view.queryByText('Ben Rao', { exact: true })).toBeTruthy(); // selector chip only
  expect(view.getAllByText('Asha Rao').length).toBeGreaterThan(0);
  expect(view.queryByLabelText('Performance for Ben Rao')).toBeNull();
});

test('parent: a response for the wrong child is never rendered', async () => {
  mockUser = { id: 'parent-1', role: 'PARENT' };
  api.listChildren.mockResolvedValue([child('s1', 'Asha Rao')]);
  api.getChildPerformance.mockResolvedValue(richPerformance({ student: { ...emptyPerformance().student, studentProfileId: 'other', name: 'Someone Else' } }));
  const view = await render(<ParentPerformanceScreen />);
  await waitFor(() => expect(api.getChildPerformance).toHaveBeenCalled());
  expect(view.queryByText('Someone Else')).toBeNull();
});

test('parent: revoked authorization refreshes the child list and explains', async () => {
  mockUser = { id: 'parent-1', role: 'PARENT' };
  api.listChildren.mockResolvedValueOnce([child('s1', 'Asha Rao')]).mockResolvedValue([]);
  api.getChildPerformance.mockRejectedValue(new AppApiError('Child not found.', 404));
  const view = await render(<ParentPerformanceScreen />);
  await waitFor(() => expect(api.listChildren).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(view.getByText('No linked children')).toBeTruthy());
  expect(view.queryByText('Asha Rao')).toBeNull();
});

test('parent: expired session shows a sign-in message', async () => {
  mockUser = { id: 'parent-1', role: 'PARENT' };
  api.listChildren.mockRejectedValue(new AppApiError('Unauthorized', 401));
  const view = await render(<ParentPerformanceScreen />);
  await waitFor(() => expect(view.getByText(/session has expired/i)).toBeTruthy());
  expect(api.getChildPerformance).not.toHaveBeenCalled();
});
