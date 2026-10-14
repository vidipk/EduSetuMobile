import { performanceApi } from '@/api/academics/performance';
import { apiClient } from '@/api/client';
import { AppApiError } from '@/api/client/error';
import { describeError, evidenceLines, marksText, percentText, percentValue } from '@/features/performance/format';
import { presetRange, validateRange } from '@/features/performance/period';

jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn() } }));

const get = jest.mocked(apiClient.get);

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { ok: true } });
});

test('student and parent endpoints use the documented paths without an /api/v1 prefix', async () => {
  await performanceApi.getMyPerformance();
  await performanceApi.getChildPerformance('child-1', { subjectId: 'math' });
  expect(get).toHaveBeenNthCalledWith(1, '/students/me/performance', { params: {} });
  expect(get).toHaveBeenNthCalledWith(2, '/parents/me/children/child-1/performance', { params: { subjectId: 'math' } });
  expect(get.mock.calls.every(([path]) => !String(path).includes('/api/v1'))).toBe(true);
});

test('path parameters are URL-encoded', async () => {
  await performanceApi.getChildPerformance('a/b?c');
  await performanceApi.getSectionPerformance('c 1', 's/2');
  expect(get.mock.calls[0][0]).toBe('/parents/me/children/a%2Fb%3Fc/performance');
  expect(get.mock.calls[1][0]).toBe('/teachers/me/classes/c%201/sections/s%2F2/performance');
});

test('teacher endpoints send filters, pagination and follow-up flag; empty values are dropped', async () => {
  await performanceApi.getTeacherOverview({ academicYearId: 'y1', subjectId: '' });
  await performanceApi.getSectionPerformance('c1', 's1', { subjectId: 'math', page: 2, limit: 500, followUpOnly: true, from: '2026-06-01', to: '2026-06-30' });
  await performanceApi.getSectionPerformance('c1', 's1', { followUpOnly: false });
  await performanceApi.getTeacherStudentPerformance('stu-1');
  expect(get.mock.calls[0]).toEqual(['/teachers/me/performance/overview', { params: { academicYearId: 'y1' } }]);
  expect(get.mock.calls[1][1]).toEqual({ params: { from: '2026-06-01', to: '2026-06-30', subjectId: 'math', page: 2, limit: 100, followUpOnly: true } });
  expect(get.mock.calls[2][1]).toEqual({ params: {} });
  expect(get.mock.calls[3][0]).toBe('/teachers/me/students/stu-1/performance');
});

test('invalid date ranges are rejected before any request is made', async () => {
  await expect(performanceApi.getMyPerformance({ from: '2026-07-01', to: '2026-06-01' })).rejects.toThrow(/before the start/);
  await expect(performanceApi.getMyPerformance({ from: '2026-02-30' })).rejects.toThrow(/real calendar dates/);
  await expect(performanceApi.getMyPerformance({ from: '2020-01-01', to: '2026-01-01' })).rejects.toThrow(/longer than/);
  expect(get).not.toHaveBeenCalled();
});

test('date helpers', () => {
  expect(validateRange('2026-06-01', '2026-06-30')).toBeNull();
  expect(validateRange(undefined, undefined)).toBeNull();
  expect(validateRange('06/01/2026')).not.toBeNull();
  expect(presetRange('academic-year')).toEqual({});
  expect(presetRange('last-30', new Date(2026, 9, 14))).toEqual({ from: '2026-09-14', to: '2026-10-14' });
  expect(validateRange(presetRange('last-90').from, presetRange('last-90').to)).toBeNull();
});

test('null and missing values are never shown as zero', () => {
  expect(percentText(null)).toBe('Not enough data yet');
  expect(percentText(undefined)).toBe('Not enough data yet');
  expect(percentValue(null)).toBe('—');
  expect(percentValue(0)).toBe('0%');
  expect(percentText(66.67)).toBe('66.67%');
  expect(marksText({ scoredItems: 0, totalScore: 0, totalMax: 0 })).toBeNull();
  expect(marksText({ scoredItems: 2, totalScore: 14, totalMax: 20 })).toBe('14 of 20 marks across 2 items');
});

test('evidence is labelled, ignores unknown keys and never prints raw objects', () => {
  expect(evidenceLines({ scoredItems: 3, weightedPercentage: 40, secret: 'x', items: [{ homeworkId: 'h', title: 't', subjectName: 's', dueDate: 'd' }] })).toEqual([
    { label: 'Graded items', value: '3' },
    { label: 'Score', value: '40%' },
  ]);
});

test('errors become safe messages: session, access, network, raw JSON', () => {
  expect(describeError(new AppApiError('x', 401))).toMatchObject({ sessionExpired: true, message: expect.stringMatching(/session has expired/i) });
  expect(describeError(new AppApiError('x', 403))).toMatchObject({ forbidden: true });
  expect(describeError(new AppApiError('x', 404))).toMatchObject({ notFound: true });
  expect(describeError(new Error('Network Error')).message).toMatch(/Could not reach EduSetu/);
  expect(describeError(new AppApiError('{"statusCode":500}', 500)).message).toBe('Something went wrong. Please try again.');
  expect(describeError(new AppApiError('Invalid period', 400)).message).toBe('Invalid period');
});
