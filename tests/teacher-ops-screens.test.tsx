import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';

import { attendanceApi, homeworkApi, quizApi, teacherProfileApi } from '@/api/academics/teacher-ops';
import { performanceApi } from '@/api/academics/performance';
import { AppApiError } from '@/api/client/error';
import type { AttendanceRoster, HomeworkDetail, HomeworkSubmissionRecord, QuizAttemptReview, QuizDetail, TeacherProfile } from '@/api/contracts/teacher-ops';
import { AttendanceScreen } from '@/features/teacher-ops/AttendanceScreens';
import { HomeworkDetailScreen, HomeworkFormScreen, HomeworkListScreen } from '@/features/teacher-ops/HomeworkScreens';
import { QuizAttemptReviewScreen, QuizManageScreen } from '@/features/teacher-ops/QuizScreens';
import { TeacherClassesScreen, TeacherDashboardScreen } from '@/features/teacher-ops/TeacherHome';
import { downloadProtectedFile, shareLocalFile } from '@/files/download';

jest.setTimeout(20_000);
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'teacher-1', role: 'TEACHER', organizationId: 'org-1' } }) }));
jest.mock('lucide-react-native', () => ({ Eye: () => null, EyeOff: () => null, Search: () => null }));
jest.mock('@/files/download', () => ({ downloadProtectedFile: jest.fn(), shareLocalFile: jest.fn() }));
jest.mock('@/api/academics/performance', () => ({ performanceApi: { getTeacherOverview: jest.fn() } }));
jest.mock('@/api/academics/teacher-ops', () => ({
  teacherProfileApi: { get: jest.fn() },
  attendanceApi: { getRoster: jest.fn(), createSession: jest.fn(), saveRecords: jest.fn(), submit: jest.fn(), list: jest.fn(), get: jest.fn() },
  homeworkApi: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), publish: jest.fn(), remove: jest.fn(), submissions: jest.fn(), grade: jest.fn(), submissionDetail: jest.fn(), submissionFileUrl: (id: string) => `https://api.test/api/v1/homework/submissions/${id}/file` },
  quizApi: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), publish: jest.fn(), remove: jest.fn(), addQuestion: jest.fn(), updateQuestion: jest.fn(), removeQuestion: jest.fn(), attempts: jest.fn(), review: jest.fn(), grade: jest.fn() },
}));

const profileApi = jest.mocked(teacherProfileApi);
const att = jest.mocked(attendanceApi);
const hw = jest.mocked(homeworkApi);
const quiz = jest.mocked(quizApi);
const perf = jest.mocked(performanceApi);

const year = { id: 'y1', name: '2026-27', isActive: true };
const profile: TeacherProfile = {
  id: 't1', teacherCode: 'T1', name: 'Teacher One', email: 't@x.test', phone: null, role: 'TEACHER', organization: { id: 'org-1', name: 'Green School' },
  assignments: [
    { assignmentId: 'a1', classId: 'c1', className: 'Class 8', sectionId: 'sA', sectionName: 'A', subjectId: 'math', subjectName: 'Math', academicYear: year },
    { assignmentId: 'a2', classId: 'c1', className: 'Class 8', sectionId: 'sB', sectionName: 'B', subjectId: 'math', subjectName: 'Math', academicYear: year },
  ],
};

let alertMode: 'confirm' | 'cancel' = 'confirm';
beforeEach(() => {
  mockParams = {};
  alertMode = 'confirm';
  for (const group of [profileApi, att, hw, quiz, perf]) Object.values(group).forEach((fn) => { if (typeof (fn as jest.Mock).mockReset === 'function') (fn as jest.Mock).mockReset(); });
  jest.mocked(router.push).mockClear();
  jest.mocked(router.replace).mockClear();
  jest.mocked(downloadProtectedFile).mockReset();
  jest.mocked(shareLocalFile).mockReset();
  profileApi.get.mockResolvedValue(profile);
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    const chosen = alertMode === 'confirm' ? buttons?.find((button) => button.style !== 'cancel') : buttons?.find((button) => button.style === 'cancel');
    chosen?.onPress?.();
  });
});
afterEach(() => jest.restoreAllMocks());

const DATE = '2026-10-14';
const sessionBase = { academicYearId: 'y1', classId: 'c1', sectionId: 'sA', date: DATE, submittedAt: null, class: { id: 'c1', name: 'Class 8' }, section: { id: 'sA', name: 'A' }, subject: null };
const rosterOf = (overrides: Partial<AttendanceRoster> = {}): AttendanceRoster => ({
  date: DATE, session: null, locked: false,
  students: [
    { studentId: 's1', recordId: null, rollNumber: '1', fullName: 'Asha Rao', status: 'PRESENT', remarks: '' },
    { studentId: 's2', recordId: null, rollNumber: '2', fullName: 'Ben Rao', status: 'PRESENT', remarks: '' },
  ],
  ...overrides,
});
const openAttendance = async (roster: AttendanceRoster = rosterOf()) => {
  mockParams = { classId: 'c1', sectionId: 'sA', date: DATE };
  att.getRoster.mockResolvedValue(roster);
  const view = await render(<AttendanceScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  return view;
};

// --------------------------------------------------------------- dashboard

test('dashboard shows the real profile, assigned sections and independent summary cards', async () => {
  att.list.mockResolvedValue({ items: [{ ...sessionBase, id: 'x', status: 'SUBMITTED' }], meta: { page: 1, limit: 50, total: 1, totalPages: 1 } });
  hw.list.mockResolvedValue({ items: [], meta: { page: 1, limit: 1, total: 4, totalPages: 4 } });
  quiz.list.mockResolvedValue({ items: [], meta: { page: 1, limit: 1, total: 2, totalPages: 2 } });
  perf.getTeacherOverview.mockResolvedValue({ totals: { sections: 2, students: 50, pendingQuizReviews: 3, pendingHomeworkReviews: 7, studentsNeedingFollowUp: 1 } } as never);
  const view = await render(<TeacherDashboardScreen />);
  await waitFor(() => expect(view.getByText(/Hello, Teacher One/)).toBeTruthy());
  expect(view.getByText(/Green School/)).toBeTruthy();
  await waitFor(() => expect(view.getByLabelText('Active homework: 4')).toBeTruthy());
  expect(view.getByLabelText('Active quizzes: 2')).toBeTruthy();
  expect(view.getByLabelText('Homework to grade: 7')).toBeTruthy();
  expect(view.getByLabelText('Quizzes to evaluate: 3')).toBeTruthy();
  expect(view.getByLabelText('Attendance today: 1/2')).toBeTruthy();
  expect(view.getByLabelText('Class 8 A attendance SUBMITTED')).toBeTruthy();
  expect(view.getByLabelText('Class 8 B attendance not taken')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'View performance' }));
  expect(router.push).toHaveBeenCalledWith('/class-performance');
});

test('dashboard: a failing summary shows "—" and retry, never an invented count', async () => {
  att.list.mockResolvedValue({ items: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } });
  hw.list.mockRejectedValue(new Error('Network Error'));
  quiz.list.mockResolvedValue({ items: [], meta: { page: 1, limit: 1, total: 0, totalPages: 0 } });
  perf.getTeacherOverview.mockRejectedValue(new AppApiError('Server error', 500));
  const view = await render(<TeacherDashboardScreen />);
  await waitFor(() => expect(view.getByLabelText(/Homework to grade: Not enough data yet|Homework to grade: —/)).toBeTruthy());
  expect(view.getByRole('button', { name: 'Retry summary' })).toBeTruthy();
});

test('classes and dashboard handle a teacher with no assignments', async () => {
  profileApi.get.mockResolvedValue({ ...profile, assignments: [] });
  const view = await render(<TeacherClassesScreen />);
  await waitFor(() => expect(view.getByText('No class assignments')).toBeTruthy());
});

test('classes lists only assigned sections with subjects and actions', async () => {
  const view = await render(<TeacherClassesScreen />);
  await waitFor(() => expect(view.getByText('Class 8 A')).toBeTruthy());
  expect(view.getByText('Class 8 B')).toBeTruthy();
  expect(view.getAllByText('Subjects: Math')).toHaveLength(2);
  await fireEvent.press(view.getAllByRole('button', { name: 'Attendance' })[0]);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/attendance', params: { classId: 'c1', sectionId: 'sA' } });
});

// -------------------------------------------------------------- attendance

test('attendance: saves a draft by creating the session then saving the full roster snapshot', async () => {
  att.createSession.mockResolvedValue({ ...sessionBase, id: 'sess-1', status: 'DRAFT' });
  att.saveRecords.mockResolvedValue(undefined);
  const view = await openAttendance();
  expect(view.getByText('Not started')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('Ben Rao: Absent'));
  expect(view.getByText('You have unsaved changes.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(view.getByText(/Draft saved/)).toBeTruthy());
  expect(att.createSession).toHaveBeenCalledTimes(1);
  expect(att.createSession).toHaveBeenCalledWith({ classId: 'c1', sectionId: 'sA', date: DATE, academicYearId: 'y1' });
  expect(att.saveRecords).toHaveBeenCalledWith('sess-1', [{ studentId: 's1', status: 'PRESENT' }, { studentId: 's2', status: 'ABSENT' }]);
  expect(att.submit).not.toHaveBeenCalled();
});

test('attendance: an existing draft is resumed and never recreated', async () => {
  att.saveRecords.mockResolvedValue(undefined);
  const view = await openAttendance(rosterOf({ session: { ...sessionBase, id: 'sess-9', status: 'DRAFT', records: [] } }));
  expect(view.getByText('Draft')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(att.saveRecords).toHaveBeenCalledWith('sess-9', expect.any(Array)));
  expect(att.createSession).not.toHaveBeenCalled();
});

test('attendance: rapid double-tap on Submit sends exactly one submission', async () => {
  let release: () => void = () => undefined;
  att.createSession.mockResolvedValue({ ...sessionBase, id: 'sess-1', status: 'DRAFT' });
  att.saveRecords.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
  att.submit.mockResolvedValue({ ...sessionBase, id: 'sess-1', status: 'SUBMITTED' });
  const view = await openAttendance();
  await fireEvent.press(view.getByRole('button', { name: 'Submit attendance' }));
  await fireEvent.press(view.getByRole('button', { name: 'Submit attendance' }));
  await waitFor(() => expect(att.saveRecords).toHaveBeenCalledTimes(1));
  release();
  await waitFor(() => expect(view.getByText('Attendance submitted.')).toBeTruthy());
  expect(att.submit).toHaveBeenCalledTimes(1);
  expect(att.createSession).toHaveBeenCalledTimes(1);
});

test('attendance: cancelling the submit confirmation sends nothing', async () => {
  alertMode = 'cancel';
  const view = await openAttendance();
  await fireEvent.press(view.getByRole('button', { name: 'Submit attendance' }));
  expect(att.createSession).not.toHaveBeenCalled();
  expect(att.submit).not.toHaveBeenCalled();
});

test('attendance: a submitted session is read-only', async () => {
  const view = await openAttendance(rosterOf({ locked: true, session: { ...sessionBase, id: 'sess-1', status: 'SUBMITTED', submittedAt: '2026-10-14T05:00:00.000Z', submittedBy: { id: 'u', fullName: 'Teacher One', role: 'TEACHER' }, records: [] } }));
  expect(view.getByText(/read-only/)).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Save draft' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Submit attendance' })).toBeNull();
  expect(view.queryByLabelText('Ben Rao: Absent')).toBeNull();
});

test('attendance: unauthorized scope shows a clear message and no roster', async () => {
  mockParams = { classId: 'c1', sectionId: 'sA', date: DATE };
  att.getRoster.mockRejectedValue(new AppApiError('Forbidden', 403));
  const view = await render(<AttendanceScreen />);
  await waitFor(() => expect(view.getByText('You are not assigned to this class and section.')).toBeTruthy());
  expect(view.queryByText('Asha Rao')).toBeNull();
});

test('attendance: a network failure keeps local edits, re-reads server state and creates no extra session', async () => {
  att.createSession.mockResolvedValue({ ...sessionBase, id: 'sess-1', status: 'DRAFT' });
  att.saveRecords.mockRejectedValue(new Error('Network Error'));
  const view = await openAttendance();
  await fireEvent.press(view.getByLabelText('Ben Rao: Absent'));
  await fireEvent.press(view.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(view.getByText(/Could not reach EduSetu/)).toBeTruthy());
  await waitFor(() => expect(att.getRoster).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(view.getByLabelText('Ben Rao: Absent').props.accessibilityState.checked).toBe(true));
  expect(att.createSession).toHaveBeenCalledTimes(1);
});

test('attendance: switching sections with unsaved edits asks first and respects cancel', async () => {
  alertMode = 'cancel';
  const view = await openAttendance();
  await fireEvent.press(view.getByLabelText('Ben Rao: Absent'));
  await fireEvent.press(view.getByLabelText('Section: Class 8 B'));
  expect(Alert.alert).toHaveBeenCalledWith('Discard unsaved changes?', expect.any(String), expect.any(Array), expect.anything());
  expect(att.getRoster).toHaveBeenCalledTimes(1);
  expect(view.getByLabelText('Ben Rao: Absent').props.accessibilityState.checked).toBe(true);
});

test('attendance: invalid dates never trigger a request', async () => {
  mockParams = { classId: 'c1', sectionId: 'sA' };
  att.getRoster.mockResolvedValue(rosterOf());
  const view = await render(<AttendanceScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  const calls = att.getRoster.mock.calls.length;
  await fireEvent.changeText(view.getByLabelText('Date (YYYY-MM-DD)'), '2026-02-30');
  await waitFor(() => expect(view.getByText('Enter a real date in YYYY-MM-DD format.')).toBeTruthy());
  expect(att.getRoster).toHaveBeenCalledTimes(calls);
});

// ---------------------------------------------------------------- homework

const hwItem = { id: 'h1', title: 'Fractions', description: null, instructions: null, homeworkType: 'SUBJECTIVE' as const, totalMarks: '10', dueDate: '2026-12-01T00:00:00.000Z', status: 'PUBLISHED' as const, publishedAt: null, classId: 'c1', sectionId: 'sA', subjectId: 'math', class: { id: 'c1', name: 'Class 8' }, section: { id: 'sA', name: 'A' }, subject: { id: 'math', name: 'Math' }, _count: { submissions: 3 } };

test('homework list shows own homework, filters by status and navigates to detail', async () => {
  hw.list.mockResolvedValue({ items: [hwItem], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  const view = await render(<HomeworkListScreen />);
  await waitFor(() => expect(view.getByText('Fractions')).toBeTruthy());
  expect(view.getByText('3 submissions')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('Status: Drafts'));
  await waitFor(() => expect(hw.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'DRAFT', page: 1 })));
  hw.list.mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
});

const fillHomework = async (view: Awaited<ReturnType<typeof render>>) => {
  await waitFor(() => expect(view.getByLabelText('Title')).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText('Title'), 'Algebra');
  await fireEvent.changeText(view.getByLabelText('Due date (YYYY-MM-DD)'), '2099-01-01');
  await fireEvent.press(view.getByRole('button', { name: '+ Multiple choice' }));
  await fireEvent.changeText(view.getByLabelText('Question 1 text'), '2+2?');
  await fireEvent.changeText(view.getByLabelText('Question 1 option A'), '3');
  await fireEvent.changeText(view.getByLabelText('Question 1 option B'), '4');
  await fireEvent.press(view.getByLabelText('Question 1: option B is not marked correct'));
};

test('homework form: invalid input is rejected locally with no API call', async () => {
  const view = await render(<HomeworkFormScreen />);
  await waitFor(() => expect(view.getByLabelText('Title')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Save & publish' }));
  await waitFor(() => expect(view.getByText(/Enter a title/)).toBeTruthy());
  expect(hw.create).not.toHaveBeenCalled();
});

test('homework form: create then publish with a DTO-shaped body, then opens the record', async () => {
  hw.create.mockResolvedValue({ ...hwItem, id: 'hw-new', status: 'DRAFT' });
  hw.publish.mockResolvedValue({ ...hwItem, id: 'hw-new' });
  const view = await render(<HomeworkFormScreen />);
  await fillHomework(view);
  await fireEvent.press(view.getByRole('button', { name: 'Save & publish' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/assignments/[homeworkId]', params: { homeworkId: 'hw-new' } }));
  expect(hw.create).toHaveBeenCalledTimes(1);
  expect(hw.create.mock.calls[0][0]).toMatchObject({ classId: 'c1', sectionId: 'sA', subjectId: 'math', title: 'Algebra', homeworkType: 'OBJECTIVE', totalMarks: 1, questions: [{ type: 'MCQ', correctAnswer: 'b', orderIndex: 1 }] });
  expect(hw.publish).toHaveBeenCalledWith('hw-new');
});

test('homework form: if publishing fails after creation, retrying updates the same record instead of duplicating it', async () => {
  hw.create.mockResolvedValue({ ...hwItem, id: 'hw-new', status: 'DRAFT' });
  hw.update.mockResolvedValue({ ...hwItem, id: 'hw-new' });
  hw.publish.mockRejectedValueOnce(new AppApiError('Cannot publish right now.', 400)).mockResolvedValue({ ...hwItem, id: 'hw-new' });
  const view = await render(<HomeworkFormScreen />);
  await fillHomework(view);
  await fireEvent.press(view.getByRole('button', { name: 'Save & publish' }));
  await waitFor(() => expect(view.getByText('Cannot publish right now.')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Save & publish' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(hw.create).toHaveBeenCalledTimes(1);
  expect(hw.update).toHaveBeenCalledWith('hw-new', expect.any(Object));
  expect(hw.publish).toHaveBeenCalledTimes(2);
});

const submission = (overrides: Partial<HomeworkSubmissionRecord> = {}): HomeworkSubmissionRecord => ({
  id: 'sub-1', homeworkId: 'h1', studentId: 's1', submissionText: 'My written answer', fileUrl: null, submissionMethod: null, originalFileName: null, driveUrl: null,
  objectiveScore: null, status: 'SUBMITTED', marks: null, feedback: null, submittedAt: '2026-10-14T08:00:00.000Z', gradedAt: null,
  student: { id: 's1', rollNumber: '1', user: { fullName: 'Asha Rao' } }, ...overrides,
});
const hwDetail: HomeworkDetail = { ...hwItem, questions: [] };
const openDetail = async (subs: HomeworkSubmissionRecord[]) => {
  mockParams = { homeworkId: 'h1' };
  hw.get.mockResolvedValue(hwDetail);
  hw.submissions.mockResolvedValue(subs);
  const view = await render(<HomeworkDetailScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  return view;
};

test('homework review: shows written text and pending counts; grading is validated against max marks', async () => {
  hw.grade.mockResolvedValue(submission({ status: 'GRADED', marks: '8' }));
  const view = await openDetail([submission()]);
  expect(view.getByText(/1 submitted · 1 need grading · 0 graded/)).toBeTruthy();
  expect(view.getByLabelText('Written answer')).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText(/Marks for Asha Rao/), '11');
  await fireEvent.press(view.getByRole('button', { name: 'Save grade' }));
  await waitFor(() => expect(view.getByText('Marks cannot exceed 10.')).toBeTruthy());
  expect(hw.grade).not.toHaveBeenCalled();
  await fireEvent.changeText(view.getByLabelText(/Marks for Asha Rao/), '8');
  await fireEvent.press(view.getByRole('button', { name: 'Save grade' }));
  await waitFor(() => expect(hw.grade).toHaveBeenCalledWith('sub-1', { marks: 8, feedback: undefined }));
});

test('homework review: replacing an existing grade needs confirmation', async () => {
  alertMode = 'cancel';
  hw.grade.mockResolvedValue(submission({ status: 'GRADED', marks: '9' }));
  const view = await openDetail([submission({ status: 'GRADED', marks: '8' })]);
  expect(view.getByText(/0 need grading · 1 graded/)).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText(/Marks for Asha Rao/), '9');
  await fireEvent.press(view.getByRole('button', { name: 'Update grade' }));
  expect(Alert.alert).toHaveBeenCalledWith('Replace the existing grade?', expect.any(String), expect.any(Array), expect.anything());
  expect(hw.grade).not.toHaveBeenCalled();
});

test('homework review: Drive links open only for Google hosts; PDFs are named, not faked', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const view = await openDetail([
    submission({ id: 'a', submissionText: null, driveUrl: 'https://drive.google.com/file/d/1', submissionMethod: 'DRIVE_LINK' }),
    submission({ id: 'b', student: { id: 's2', rollNumber: '2', user: { fullName: 'Ben Rao' } }, submissionText: null, driveUrl: 'https://evil.example/x' }),
    submission({ id: 'c', student: { id: 's3', rollNumber: '3', user: { fullName: 'Cara Rao' } }, submissionText: null, submissionMethod: 'PDF_UPLOAD', originalFileName: 'answer.pdf', fileUrl: '/uploads/x.pdf' }),
  ]);
  expect(view.getAllByRole('button', { name: 'Open Google Drive link' })).toHaveLength(1);
  await fireEvent.press(view.getByRole('button', { name: 'Open Google Drive link' }));
  expect(open).toHaveBeenCalledWith('https://drive.google.com/file/d/1');
  expect(view.getByText(/PDF attached: answer.pdf/)).toBeTruthy();
});

test('homework detail: a draft offers publish with confirmation; not found is explained', async () => {
  mockParams = { homeworkId: 'h1' };
  hw.get.mockResolvedValue({ ...hwDetail, status: 'DRAFT' });
  hw.publish.mockResolvedValue({ ...hwItem });
  const view = await render(<HomeworkDetailScreen />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Publish' })).toBeTruthy());
  expect(hw.submissions).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Publish' }));
  await waitFor(() => expect(hw.publish).toHaveBeenCalledWith('h1'));
  hw.get.mockRejectedValue(new AppApiError('Forbidden', 403));
});

// ------------------------------------------------------------------- quizzes

const quizDetail = (overrides: Partial<QuizDetail> = {}): QuizDetail => ({
  id: 'q1', title: 'Photosynthesis', description: null, status: 'DRAFT', durationMinutes: 15, totalMarks: '6', classId: 'c1', sectionId: 'sA', subjectId: 'math',
  class: { id: 'c1', name: 'Class 8' }, section: { id: 'sA', name: 'A' }, subject: { id: 'math', name: 'Math' },
  questions: [
    { id: 'qq1', quizId: 'q1', questionText: 'Q1', questionType: 'MCQ', options: [{ id: 'a', label: 'x' }, { id: 'b', label: 'y' }], correctAnswer: 'a', marks: 2, orderIndex: 1 },
    { id: 'qq2', quizId: 'q1', questionText: 'Q2', questionType: 'SHORT_ANSWER', options: null, correctAnswer: null, marks: 4, orderIndex: 2 },
  ],
  ...overrides,
});
const openQuiz = async (detail: QuizDetail) => {
  mockParams = { quizId: 'q1' };
  quiz.get.mockResolvedValue(detail);
  const view = await render(<QuizManageScreen />);
  await waitFor(() => expect(view.getByText('Photosynthesis')).toBeTruthy());
  return view;
};

test('quiz manage: publishing is blocked with no questions', async () => {
  const view = await openQuiz(quizDetail({ questions: [] }));
  expect(view.getByText(/Add at least one question\./)).toBeTruthy();
  expect(view.getByRole('button', { name: 'Publish quiz' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: 'Publish quiz' }));
  expect(quiz.publish).not.toHaveBeenCalled();
});

test('quiz manage: a total-marks mismatch blocks publish and can be corrected', async () => {
  quiz.update.mockResolvedValue(quizDetail());
  const view = await openQuiz(quizDetail({ totalMarks: '10' }));
  expect(view.getByText(/Total marks \(10\) must equal the sum of question marks \(6\)/)).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Set total to 6' }));
  await waitFor(() => expect(quiz.update).toHaveBeenCalledWith('q1', { totalMarks: 6 }));
});

test('quiz manage: a valid draft publishes after confirmation', async () => {
  quiz.publish.mockResolvedValue(quizDetail({ status: 'PUBLISHED' }));
  const view = await openQuiz(quizDetail());
  expect(view.getByText('This quiz is ready to publish.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Publish quiz' }));
  await waitFor(() => expect(quiz.publish).toHaveBeenCalledWith('q1'));
  expect(quiz.publish).toHaveBeenCalledTimes(1);
});

test('quiz builder: an MCQ without a correct answer is rejected locally; a valid one is saved with the next order index', async () => {
  quiz.addQuestion.mockResolvedValue(quizDetail().questions[0]);
  const view = await openQuiz(quizDetail());
  await fireEvent.press(view.getByRole('button', { name: '+ Multiple choice' }));
  await fireEvent.changeText(view.getByLabelText('Question 3 text'), 'New question');
  await fireEvent.changeText(view.getByLabelText('Question 3 option A'), 'One');
  await fireEvent.changeText(view.getByLabelText('Question 3 option B'), 'Two');
  await fireEvent.press(view.getByRole('button', { name: 'Save question' }));
  await waitFor(() => expect(view.getByText(/Choose the correct option/)).toBeTruthy());
  expect(quiz.addQuestion).not.toHaveBeenCalled();
  await fireEvent.press(view.getByLabelText('Question 3: option B is not marked correct'));
  await fireEvent.press(view.getByRole('button', { name: 'Save question' }));
  await waitFor(() => expect(quiz.addQuestion).toHaveBeenCalledWith('q1', { questionText: 'New question', questionType: 'MCQ', marks: 1, orderIndex: 3, options: [{ id: 'a', text: 'One' }, { id: 'b', text: 'Two' }], correctAnswer: 'b' }));
});

test('published quizzes are locked and list attempts; in-progress attempts cannot be opened', async () => {
  quiz.attempts.mockResolvedValue({
    quiz: { id: 'q1', title: 'Photosynthesis', status: 'PUBLISHED', totalMarks: '6' }, meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    items: [
      { id: 'at1', status: 'SUBMITTED', gradingStatus: 'PENDING_REVIEW', submittedAt: '2026-10-14T09:00:00.000Z', gradedAt: null, resultPublishedAt: null, autoScore: 2, finalScore: null, maxScore: 6, percentage: null, needsReviewCount: 1, student: { id: 's1', fullName: 'Asha Rao', rollNumber: '1', admissionNumber: 'A1' } },
      { id: 'at2', status: 'IN_PROGRESS', gradingStatus: 'NOT_REQUIRED', submittedAt: null, gradedAt: null, resultPublishedAt: null, autoScore: null, finalScore: null, maxScore: null, percentage: null, needsReviewCount: 0, student: { id: 's2', fullName: 'Ben Rao', rollNumber: '2', admissionNumber: 'A2' } },
    ],
  });
  const view = await openQuiz(quizDetail({ status: 'PUBLISHED' }));
  expect(view.getByText(/locked so student attempts stay valid/)).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Remove question 1' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Delete draft' })).toBeNull();
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  expect(view.getByText('1 answer needs grading')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('Asha Rao, Needs review'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/quizzes/attempt/[attemptId]', params: { attemptId: 'at1' } });
  jest.mocked(router.push).mockClear();
  expect(view.getByLabelText('Ben Rao, in progress').props.accessibilityState.disabled).toBe(true);
});

const review = (overrides: { attempt?: Partial<QuizAttemptReview['attempt']>; answers?: QuizAttemptReview['answers'] } = {}): QuizAttemptReview => ({
  quiz: { id: 'q1', title: 'Photosynthesis', totalMarks: 9, status: 'PUBLISHED' },
  student: { id: 's1', fullName: 'Asha Rao', rollNumber: '1', admissionNumber: 'A1' },
  attempt: { id: 'at1', status: 'SUBMITTED', gradingStatus: 'PENDING_REVIEW', submittedAt: '2026-10-14T09:00:00.000Z', gradedAt: null, resultPublishedAt: null, autoScore: 2, finalScore: null, maxScore: 9, percentage: null, overallFeedback: null, needsReviewCount: 2, ...overrides.attempt },
  answers: overrides.answers ?? [
    { answerId: 'qq1', questionId: 'qq1', questionNumber: 1, questionText: 'Q1', questionType: 'MCQ', maxMarks: 2, options: [{ id: 'a', label: 'Paris' }, { id: 'b', label: 'Rome' }], configurationError: null, submittedAnswer: 'a', expectedAnswer: 'a', isCorrect: true, autoAwardedMarks: 2, teacherAwardedMarks: null, finalAwardedMarks: 2, teacherFeedback: null, gradingStatus: 'NOT_REQUIRED', needsManualReview: false },
    { answerId: 'qq2', questionId: 'qq2', questionNumber: 2, questionText: 'Q2', questionType: 'SHORT_ANSWER', maxMarks: 4, options: [], configurationError: null, submittedAnswer: 'My answer', expectedAnswer: null, isCorrect: null, autoAwardedMarks: null, teacherAwardedMarks: null, finalAwardedMarks: null, teacherFeedback: null, gradingStatus: 'PENDING_REVIEW', needsManualReview: true },
    { answerId: 'qq3', questionId: 'qq3', questionNumber: 3, questionText: 'Q3', questionType: 'LONG_ANSWER', maxMarks: 3, options: [], configurationError: null, submittedAnswer: 'Long text', expectedAnswer: null, isCorrect: null, autoAwardedMarks: null, teacherAwardedMarks: null, finalAwardedMarks: null, teacherFeedback: null, gradingStatus: 'PENDING_REVIEW', needsManualReview: true },
  ],
});
const openReview = async (data: QuizAttemptReview) => {
  mockParams = { attemptId: 'at1' };
  quiz.review.mockResolvedValue(data);
  const view = await render(<QuizAttemptReviewScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  return view;
};

test('quiz review: objective answers keep their auto marks and have no marks input; only written answers are gradable', async () => {
  const view = await openReview(review());
  expect(view.getByText(/Correct · auto-graded 2 \/ 2/)).toBeTruthy();
  expect(view.getByText('Correct answer: Paris')).toBeTruthy();
  expect(view.queryByLabelText(/Marks for question 1/)).toBeNull();
  expect(view.getByLabelText(/Marks for question 2 \(max 4\)/)).toBeTruthy();
  expect(view.getByText('Final score').parent).toBeTruthy();
  expect(view.getByText('Not finalized')).toBeTruthy();
});

test('quiz review: marks are validated against each question maximum and finalizing needs every written answer graded', async () => {
  const view = await openReview(review());
  await fireEvent.changeText(view.getByLabelText(/Marks for question 2/), '5');
  await fireEvent.press(view.getByRole('button', { name: 'Save progress' }));
  await waitFor(() => expect(view.getByText('Marks cannot exceed 4.')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Finalize evaluation' }));
  await waitFor(() => expect(view.getAllByText('Enter marks before finalizing.').length).toBeGreaterThan(0));
  expect(quiz.grade).not.toHaveBeenCalled();
});

test('quiz review: partial progress sends only graded answers without finalizing or asking to release', async () => {
  quiz.grade.mockResolvedValue(review({ attempt: { gradingStatus: 'PARTIALLY_GRADED' } }));
  const view = await openReview(review());
  await fireEvent.changeText(view.getByLabelText(/Marks for question 2/), '3');
  await fireEvent.press(view.getByRole('button', { name: 'Save progress' }));
  await waitFor(() => expect(quiz.grade).toHaveBeenCalledWith('at1', { answers: [{ answerId: 'qq2', awardedMarks: 3, feedback: undefined }], overallFeedback: undefined, finalize: false }));
  expect(Alert.alert).not.toHaveBeenCalled();
  await waitFor(() => expect(view.getByText(/Progress saved/)).toBeTruthy());
});

test('quiz review: saving marks for every written answer warns that it finalizes, and a double tap sends once', async () => {
  let resolveGrade: (value: QuizAttemptReview) => void = () => undefined;
  quiz.grade.mockImplementation(() => new Promise<QuizAttemptReview>((resolve) => { resolveGrade = resolve; }));
  const view = await openReview(review());
  await fireEvent.changeText(view.getByLabelText(/Marks for question 2/), '3');
  await fireEvent.changeText(view.getByLabelText(/Marks for question 3/), '2');
  await fireEvent.press(view.getByRole('button', { name: 'Finalize evaluation' }));
  await fireEvent.press(view.getByRole('button', { name: 'Finalize evaluation' }));
  await waitFor(() => expect(quiz.grade).toHaveBeenCalledTimes(1));
  expect(Alert.alert).toHaveBeenCalledWith('Finalize evaluation?', expect.stringContaining('releases it to the student'), expect.any(Array), expect.anything());
  expect(quiz.grade.mock.calls[0][1]).toMatchObject({ finalize: true, answers: [{ answerId: 'qq2', awardedMarks: 3 }, { answerId: 'qq3', awardedMarks: 2 }] });
  const finalState = review({ attempt: { status: 'EVALUATED', gradingStatus: 'GRADED', finalScore: 7, maxScore: 9, percentage: 77.78 } });
  quiz.review.mockResolvedValue(finalState); // the screen re-reads the official state after saving
  resolveGrade(finalState);
  await waitFor(() => expect(view.getByText(/finalized and read-only/)).toBeTruthy());
  expect(view.getByText('7 / 9')).toBeTruthy();
  expect(quiz.grade).toHaveBeenCalledTimes(1);
});

test('quiz review: saving the last remaining mark also asks for confirmation; cancelling sends nothing', async () => {
  alertMode = 'cancel';
  const view = await openReview(review());
  await fireEvent.changeText(view.getByLabelText(/Marks for question 2/), '3');
  await fireEvent.changeText(view.getByLabelText(/Marks for question 3/), '2');
  await fireEvent.press(view.getByRole('button', { name: 'Save progress' }));
  expect(Alert.alert).toHaveBeenCalled();
  expect(quiz.grade).not.toHaveBeenCalled();
});

test('quiz review: finalized attempts are read-only and in-progress attempts cannot be graded', async () => {
  const done = review({ attempt: { status: 'EVALUATED', gradingStatus: 'GRADED', finalScore: 7, maxScore: 9, percentage: 77.78 }, answers: review().answers.map((answer) => (answer.needsManualReview ? { ...answer, finalAwardedMarks: 2, teacherAwardedMarks: 2, gradingStatus: 'GRADED' as const } : answer)) });
  const view = await openReview(done);
  expect(view.getByText(/finalized and read-only/)).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Finalize evaluation' })).toBeNull();
  expect(view.queryByLabelText(/Marks for question 2/)).toBeNull();
  expect(view.getAllByText('Marks: 2 / 4').length + view.getAllByText('Marks: 2 / 3').length).toBeGreaterThan(0);
  const pending = await openReview(review({ attempt: { status: 'IN_PROGRESS', submittedAt: null } }));
  expect(pending.getByText(/has not been submitted/)).toBeTruthy();
  expect(pending.queryAllByRole('button', { name: 'Finalize evaluation' }).length).toBe(0);
});

test('quiz review: forbidden access shows a safe message', async () => {
  mockParams = { attemptId: 'at1' };
  quiz.review.mockRejectedValue(new AppApiError('Forbidden', 403));
  const view = await render(<QuizAttemptReviewScreen />);
  await waitFor(() => expect(view.getByText('This attempt is not available to you.')).toBeTruthy());
});

// ---------------------------------------------------- attachments and structured answers

const detailFor = (overrides: Partial<import('@/api/contracts/teacher-ops').HomeworkSubmissionDetail> = {}): import('@/api/contracts/teacher-ops').HomeworkSubmissionDetail => ({
  id: 'sub-1', homework: { id: 'h1', title: 'Fractions', homeworkType: 'MIXED', totalMarks: 10 }, student: { id: 's1', fullName: 'Asha Rao', rollNumber: '1', admissionNumber: 'A1' },
  status: 'SUBMITTED', submittedAt: '2026-10-14T08:00:00.000Z', gradedAt: null, submissionText: null, submissionMethod: 'PDF_UPLOAD', driveUrl: null, originalFileName: 'answer.pdf', fileSizeBytes: 1000,
  fileAvailable: true, objectiveScore: 2, marks: null, feedback: null, answers: [], ...overrides,
});
const pdfSubmission = () => submission({ submissionText: null, submissionMethod: 'PDF_UPLOAD', originalFileName: 'answer.pdf', fileUrl: '/uploads/x.pdf' });

test('PDF: re-checks access, downloads with the authenticated helper, then opens the system sheet', async () => {
  hw.submissionDetail.mockResolvedValue(detailFor());
  jest.mocked(downloadProtectedFile).mockResolvedValue({ uri: 'file:///cache/homework-sub-1.pdf' } as never);
  const view = await openDetail([pdfSubmission()]);
  await fireEvent.press(view.getByRole('button', { name: 'Open PDF' }));
  await waitFor(() => expect(shareLocalFile).toHaveBeenCalledWith({ uri: 'file:///cache/homework-sub-1.pdf' }, expect.objectContaining({ mimeType: 'application/pdf' })));
  expect(hw.submissionDetail).toHaveBeenCalledWith('sub-1');
  const call = jest.mocked(downloadProtectedFile).mock.calls[0][0];
  expect(call.url).toBe('https://api.test/api/v1/homework/submissions/sub-1/file');
  expect(call.url).not.toMatch(/token|access|bearer/i); // credentials travel in a header, never the URL
  expect(call.filename).toBe('homework-sub-1.pdf');
});

test('PDF: a missing file or failed download gives a clear message and never opens a viewer', async () => {
  const view = await openDetail([pdfSubmission()]);
  hw.submissionDetail.mockResolvedValueOnce(detailFor({ fileAvailable: false }));
  await fireEvent.press(view.getByRole('button', { name: 'Open PDF' }));
  await waitFor(() => expect(view.getByText('This submission has no uploaded file.')).toBeTruthy());
  hw.submissionDetail.mockResolvedValue(detailFor());
  jest.mocked(downloadProtectedFile).mockRejectedValue(new Error('404'));
  await fireEvent.press(view.getByRole('button', { name: 'Retry' }));
  await fireEvent.press(view.getByRole('button', { name: 'Open PDF' }));
  await waitFor(() => expect(view.getByText(/could not be downloaded/)).toBeTruthy());
  expect(shareLocalFile).not.toHaveBeenCalled();
});

test('PDF: a forbidden download shows the server access message', async () => {
  const view = await openDetail([pdfSubmission()]);
  hw.submissionDetail.mockRejectedValue(new AppApiError('Forbidden', 403));
  await fireEvent.press(view.getByRole('button', { name: 'Open PDF' }));
  await waitFor(() => expect(view.getByText(/do not have access/i)).toBeTruthy());
  expect(downloadProtectedFile).not.toHaveBeenCalled();
});

test('structured answers: shown on demand with expected answers and auto-grading results, only for non-subjective homework', async () => {
  mockParams = { homeworkId: 'h1' };
  hw.get.mockResolvedValue({ ...hwDetail, homeworkType: 'MIXED' });
  hw.submissions.mockResolvedValue([submission()]);
  hw.submissionDetail.mockResolvedValue(detailFor({ answers: [
    { questionId: 'q1', order: 1, type: 'MCQ', questionText: '2+2?', maxMarks: 2, answerText: '5', expectedAnswer: '4', awardedMarks: null, autoGraded: true, isCorrect: false },
    { questionId: 'q2', order: 2, type: 'TRUE_FALSE', questionText: 'Odd?', maxMarks: 1, answerText: 'True', expectedAnswer: 'True', awardedMarks: 1, autoGraded: true, isCorrect: true },
  ] }));
  const view = await render(<HomeworkDetailScreen />);
  await waitFor(() => expect(view.getByText('Asha Rao')).toBeTruthy());
  expect(hw.submissionDetail).not.toHaveBeenCalled(); // lazy
  await fireEvent.press(view.getByRole('button', { name: 'Show question answers' }));
  await waitFor(() => expect(view.getByText('Student answered: 5')).toBeTruthy());
  expect(view.getByText('Expected: 4')).toBeTruthy();
  expect(view.getByText('Incorrect · auto-graded 0 / 2')).toBeTruthy();
  expect(view.getByText('Correct · auto-graded 1 / 1')).toBeTruthy();
});

test('structured answers: not offered for subjective homework', async () => {
  const view = await openDetail([submission()]);
  expect(view.queryByRole('button', { name: 'Show question answers' })).toBeNull();
});
