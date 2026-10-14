import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { performanceApi } from '@/api/academics/performance';
import { AppApiError } from '@/api/client/error';
import type { SectionPerformance, TeacherClassCard } from '@/api/contracts/performance';
import { TeacherOverviewScreen, TeacherSectionScreen, TeacherStudentScreen } from '@/features/performance/TeacherScreens';
import { emptyPerformance, overview, richPerformance, sectionPage, studentRow } from './fixtures/performance';

let mockParams: Record<string, string> = { classId: 'c1', sectionId: 'sec1', studentProfileId: 'stu-1' };

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'teacher-1', role: 'TEACHER' } }) }));
jest.mock('lucide-react-native', () => ({ Eye: () => null, EyeOff: () => null, Search: () => null }));
jest.mock('@/api/academics/performance', () => ({
  performanceApi: { getTeacherOverview: jest.fn(), getSectionPerformance: jest.fn(), getTeacherStudentPerformance: jest.fn(), listTeacherClasses: jest.fn() },
}));

const api = jest.mocked(performanceApi);

const card: TeacherClassCard = {
  assignmentId: 'a1', classId: 'c1', className: 'Class 8', sectionId: 'sec1', sectionName: 'A', displayName: 'Class 8 A',
  subjects: [{ subjectId: 'math', subjectName: 'Mathematics' }, { subjectId: 'sci', subjectName: 'Science' }],
  studentCount: 30, academicYear: { id: 'y1', name: '2026-27', isActive: true },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  mockParams = { classId: 'c1', sectionId: 'sec1', studentProfileId: 'stu-1' };
  Object.values(api).forEach((fn) => (fn as jest.Mock).mockReset());
  jest.mocked(router.push).mockClear();
  api.listTeacherClasses.mockResolvedValue([card]);
});

// ----------------------------------------------------------------- overview

test('overview lists assigned sections with summaries and totals, and drills down', async () => {
  api.getTeacherOverview.mockResolvedValue(overview());
  const view = await render(<TeacherOverviewScreen />);
  await waitFor(() => expect(view.getByText('Class 8 A')).toBeTruthy());
  expect(view.getByText('Class 8 B')).toBeTruthy();
  expect(view.getByText('Quizzes to review')).toBeTruthy();
  expect(view.getAllByText('75%').length).toBeGreaterThan(0);
  await fireEvent.press(view.getByLabelText('Class 8 A performance'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/section/[classId]/[sectionId]', params: { classId: 'c1', sectionId: 'sec1' } });
});

test('overview: truncated data is flagged, empty overview explained, forbidden handled', async () => {
  const base = overview();
  api.getTeacherOverview.mockResolvedValueOnce(overview({ sections: [], totals: { ...base.totals, sections: 0, students: 0 }, dataNotes: { ...base.dataNotes, truncatedAssessments: true } }));
  const view = await render(<TeacherOverviewScreen />);
  await waitFor(() => expect(view.getByText('No assigned sections')).toBeTruthy());
  expect(view.getByText(/Incomplete data/)).toBeTruthy();

  api.getTeacherOverview.mockRejectedValueOnce(new AppApiError('Forbidden', 403));
  await fireEvent.press(view.getByLabelText('Period: Last 30 days'));
  await waitFor(() => expect(view.getByText(/do not have access/i)).toBeTruthy());
});

test('overview: null section averages show "Not enough data yet"', async () => {
  const base = overview();
  api.getTeacherOverview.mockResolvedValue(overview({ sections: [{ ...base.sections[0], summary: { ...base.sections[0].summary, overall: { ...base.sections[0].summary.overall, weightedPercentage: null, scoredItems: 0 } } }] }));
  const view = await render(<TeacherOverviewScreen />);
  await waitFor(() => expect(view.getByText('Class 8 A')).toBeTruthy());
  expect(view.getAllByText('Not enough data yet').length).toBeGreaterThan(0);
});

// ------------------------------------------------------------------ section

test('section: shows the section, students, follow-up reasons and navigates to a student', async () => {
  const flagged = studentRow('s1', { name: 'Asha Rao', overallPercentage: 38, scoredItems: 4, followUp: { required: true, reasons: [{ code: 'LOW_SUBJECT_SCORE', status: 'flagged', subjectName: 'Mathematics', message: 'Mathematics: released scores average 38% across 4 graded items.', evidence: {} }] } });
  api.getSectionPerformance.mockResolvedValue(sectionPage([flagged, studentRow('s2', { name: 'Ben Rao' })], { page: 1, totalPages: 1, total: 2 }));
  const view = await render(<TeacherSectionScreen />);
  await waitFor(() => expect(view.getByText('Class 8 A')).toBeTruthy());
  expect(api.getSectionPerformance).toHaveBeenCalledWith('c1', 'sec1', expect.objectContaining({ page: 1, limit: 25, followUpOnly: false, subjectId: undefined }));
  expect(view.getByText('Showing 2 of 2 students')).toBeTruthy();
  expect(view.getByText(/Mathematics: released scores average 38%/)).toBeTruthy();
  expect(view.getByText('Follow-up')).toBeTruthy();
  expect(view.getByText(/Showing subjects you teach: Mathematics, Science/)).toBeTruthy();
  await fireEvent.press(view.getByLabelText('Asha Rao performance'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/student/[studentProfileId]', params: { studentProfileId: 's1' } });
});

test('section: subject filter offers only assigned subjects and refetches page 1', async () => {
  api.getSectionPerformance.mockResolvedValue(sectionPage([studentRow('s1')], { page: 1, totalPages: 1, total: 1 }));
  const view = await render(<TeacherSectionScreen />);
  await waitFor(() => expect(view.getByLabelText('Subject: Science')).toBeTruthy());
  expect(view.queryByLabelText('Subject: History')).toBeNull();
  await fireEvent.press(view.getByLabelText('Subject: Science'));
  await waitFor(() => expect(api.getSectionPerformance).toHaveBeenLastCalledWith('c1', 'sec1', expect.objectContaining({ subjectId: 'sci', page: 1 })));
});

test('section: follow-up-only filter is sent to the backend', async () => {
  api.getSectionPerformance.mockResolvedValue(sectionPage([studentRow('s1')], { page: 1, totalPages: 1, total: 1 }));
  const view = await render(<TeacherSectionScreen />);
  await waitFor(() => expect(view.getByText('Student s1')).toBeTruthy());
  api.getSectionPerformance.mockResolvedValue(sectionPage([], { page: 1, totalPages: 0, total: 0 }));
  await fireEvent.press(view.getByLabelText('Students: Follow-up only'));
  await waitFor(() => expect(api.getSectionPerformance).toHaveBeenLastCalledWith('c1', 'sec1', expect.objectContaining({ followUpOnly: true, page: 1 })));
  await waitFor(() => expect(view.getByText('No students need follow-up')).toBeTruthy());
});

test('section: load more appends the next page, keeps earlier students and drops duplicates', async () => {
  api.getSectionPerformance.mockImplementation(async (_c, _s, query) => {
    if (query?.page === 2) return sectionPage([studentRow('s2'), studentRow('s3')], { page: 2, totalPages: 2, total: 3 });
    return sectionPage([studentRow('s1'), studentRow('s2')], { page: 1, totalPages: 2, total: 3 });
  });
  const view = await render(<TeacherSectionScreen />);
  await waitFor(() => expect(view.getByText('Showing 2 of 3 students')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Load more students' }));
  await waitFor(() => expect(view.getByText('Showing 3 of 3 students')).toBeTruthy());
  expect(view.getAllByText('Student s2')).toHaveLength(1);
  expect(view.getByText('Student s1')).toBeTruthy();
  expect(view.getByText('Student s3')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Load more students' })).toBeNull();
  expect(api.getSectionPerformance).toHaveBeenCalledWith('c1', 'sec1', expect.objectContaining({ page: 2 }));
});

test('section: a late page from an old filter is not merged into the new list', async () => {
  const latePage = deferred<SectionPerformance>();
  api.getSectionPerformance.mockImplementation(async (_c, _s, query) => {
    if (query?.page === 2) return latePage.promise;
    if (query?.subjectId === 'sci') return sectionPage([studentRow('sci-1')], { page: 1, totalPages: 1, total: 1 });
    return sectionPage([studentRow('all-1')], { page: 1, totalPages: 2, total: 2 });
  });
  const view = await render(<TeacherSectionScreen />);
  await waitFor(() => expect(view.getByText('Student all-1')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Load more students' }));
  await fireEvent.press(view.getByLabelText('Subject: Science'));
  await waitFor(() => expect(view.getByText('Student sci-1')).toBeTruthy());
  await act(async () => { latePage.resolve(sectionPage([studentRow('stale-2')], { page: 2, totalPages: 2, total: 2 })); });
  expect(view.queryByText('Student stale-2')).toBeNull();
  expect(view.queryByText('Student all-1')).toBeNull();
  expect(view.getByText('Student sci-1')).toBeTruthy();
});

test('section: truncated data shows a notice and does not hide it', async () => {
  const base = sectionPage([studentRow('s1')], { page: 1, totalPages: 1, total: 1 });
  api.getSectionPerformance.mockResolvedValue({ ...base, dataNotes: { ...base.dataNotes, truncatedStudents: true } });
  const view = await render(<TeacherSectionScreen />);
  await waitFor(() => expect(view.getByText(/only part of the class was included/)).toBeTruthy());
});

test('section: forbidden access explains the assignment limit and offers no retry loop', async () => {
  api.getSectionPerformance.mockRejectedValue(new AppApiError('You are not assigned to this class and section.', 403));
  const view = await render(<TeacherSectionScreen />);
  await waitFor(() => expect(view.getByText('You are not assigned to this class and section.')).toBeTruthy());
  expect(view.queryByText('Student s1')).toBeNull();
});

test('section: a failed next page keeps loaded students and can be retried', async () => {
  api.getSectionPerformance.mockImplementation(async (_c, _s, query) => {
    if (query?.page === 2) throw new Error('Network Error');
    return sectionPage([studentRow('s1')], { page: 1, totalPages: 2, total: 2 });
  });
  const view = await render(<TeacherSectionScreen />);
  await waitFor(() => expect(view.getByText('Student s1')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Load more students' }));
  await waitFor(() => expect(view.getByText(/Could not reach EduSetu/)).toBeTruthy());
  expect(view.getByText('Student s1')).toBeTruthy();
});

// ------------------------------------------------------------------ student

test('teacher student detail shows released results, follow-up reasons and the assigned-subjects notice', async () => {
  api.getTeacherStudentPerformance.mockResolvedValue(richPerformance({ scope: { subjectId: null, assignedSubjectsOnly: true }, student: { ...emptyPerformance().student, studentProfileId: 'stu-1' } }));
  const view = await render(<TeacherStudentScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  expect(api.getTeacherStudentPerformance).toHaveBeenCalledWith('stu-1', { subjectId: undefined });
  expect(view.getByLabelText('Quiz average: 70%')).toBeTruthy();
  expect(view.getByText('Areas to review')).toBeTruthy();
  expect(view.getByText('Showing only the subjects you teach.')).toBeTruthy();
  expect(view.getByText(/taught by other teachers are not shown/)).toBeTruthy();
});

test('teacher student detail: unassigned or unknown student shows a clear message', async () => {
  api.getTeacherStudentPerformance.mockRejectedValue(new AppApiError('Student not found.', 404));
  const view = await render(<TeacherStudentScreen />);
  await waitFor(() => expect(view.getByText(/not available in your current class assignments/)).toBeTruthy());
});
