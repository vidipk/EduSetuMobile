import type { QuizDetail, RosterStudent, TeacherProfile } from '@/api/contracts/teacher-ops';
import {
  activeAssignments,
  attendanceCounts,
  buildCreateQuizRequest,
  buildHomeworkRequest,
  buildQuizQuestionInput,
  buildRecordSnapshot,
  changeQuestionType,
  dueDateIso,
  hasUnsavedChanges,
  homeworkDraftErrors,
  homeworkTotalMarks,
  inferHomeworkType,
  isValidDateString,
  newQuestionDraft,
  newQuizQuestionDraft,
  quizFormErrors,
  quizPublishBlockers,
  quizQuestionErrors,
  sectionScopes,
  shiftDate,
  toNumber,
  validateMarks,
  type HomeworkDraft,
} from '@/features/teacher-ops/logic';

const students: RosterStudent[] = [
  { studentId: 's1', recordId: null, rollNumber: '1', fullName: 'Asha', status: 'PRESENT', remarks: '' },
  { studentId: 's2', recordId: 'r2', rollNumber: '2', fullName: 'Ben', status: 'ABSENT', remarks: '' },
];

const profile: TeacherProfile = {
  id: 't1', teacherCode: 'T1', name: 'Teacher', email: 't@x.test', phone: null, role: 'TEACHER', organization: { id: 'o', name: 'School' },
  assignments: [
    { assignmentId: 'a1', classId: 'c1', className: 'Class 8', sectionId: 'sA', sectionName: 'A', subjectId: 'math', subjectName: 'Math', academicYear: { id: 'y1', name: '2026-27', isActive: true } },
    { assignmentId: 'a2', classId: 'c1', className: 'Class 8', sectionId: 'sA', sectionName: 'A', subjectId: 'sci', subjectName: 'Science', academicYear: { id: 'y1', name: '2026-27', isActive: true } },
    { assignmentId: 'a3', classId: 'c0', className: 'Class 7', sectionId: 'sA', sectionName: 'A', subjectId: 'math', subjectName: 'Math', academicYear: { id: 'y0', name: '2025-26', isActive: false } },
  ],
};

describe('marks and dates', () => {
  test('validateMarks enforces numbers, range and decimals', () => {
    expect(validateMarks('', 10)).toEqual({ ok: false, error: 'Enter marks.' });
    expect(validateMarks('abc', 10).ok).toBe(false);
    expect(validateMarks('-1', 10).ok).toBe(false);
    expect(validateMarks('1.234', 10).ok).toBe(false);
    expect(validateMarks('10.5', 10)).toEqual({ ok: false, error: 'Marks cannot exceed 10.' });
    expect(validateMarks('10', 10)).toEqual({ ok: true, value: 10 });
    expect(validateMarks('0', 10)).toEqual({ ok: true, value: 0 });
    expect(validateMarks('99', null)).toEqual({ ok: true, value: 99 });
  });

  test('decimals from the backend arrive as strings and are parsed safely', () => {
    expect(toNumber('7.50')).toBe(7.5);
    expect(toNumber(null)).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });

  test('date helpers', () => {
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('28/02/2026')).toBe(false);
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(new Date(dueDateIso('2026-12-31')).getTime()).toBeGreaterThan(new Date(2026, 11, 31, 23, 0).getTime());
  });
});

describe('assignments and scopes', () => {
  test('only the active academic year is used by default; scopes merge subjects per section', () => {
    expect(activeAssignments(profile)).toHaveLength(2);
    expect(activeAssignments(profile, 'y0')).toHaveLength(1);
    expect(activeAssignments(null)).toEqual([]);
    const scopes = sectionScopes(activeAssignments(profile));
    expect(scopes).toHaveLength(1);
    expect(scopes[0].label).toBe('Class 8 A');
    expect(scopes[0].subjects.map((subject) => subject.name)).toEqual(['Math', 'Science']);
  });
});

describe('attendance drafts', () => {
  test('counts and snapshot use local edits over server state', () => {
    expect(attendanceCounts(students, {})).toEqual({ present: 1, absent: 1, total: 2 });
    expect(attendanceCounts(students, { s1: 'ABSENT' })).toEqual({ present: 0, absent: 2, total: 2 });
    expect(buildRecordSnapshot(students, { s2: 'PRESENT' })).toEqual([{ studentId: 's1', status: 'PRESENT' }, { studentId: 's2', status: 'PRESENT' }]);
  });

  test('unsaved changes are only real differences from the server', () => {
    expect(hasUnsavedChanges(students, {})).toBe(false);
    expect(hasUnsavedChanges(students, { s1: 'PRESENT' })).toBe(false);
    expect(hasUnsavedChanges(students, { s1: 'ABSENT' })).toBe(true);
  });
});

function draft(overrides: Partial<HomeworkDraft> = {}): HomeworkDraft {
  return { title: 'Fractions', description: '', instructions: '', scopeKey: 'c1:sA:y1', subjectId: 'math', dueDate: '2099-01-01', totalMarks: '', questions: [], ...overrides };
}

describe('homework drafts', () => {
  test('requires title, scope, subject, a real future due date and content', () => {
    const errors = homeworkDraftErrors(draft({ title: ' ', scopeKey: '', subjectId: '', dueDate: '2020-01-01' }), { requireFutureDue: true });
    expect(errors).toEqual(expect.arrayContaining(['Enter a title.', 'Choose a class and section.', 'Choose a subject.', 'Due date cannot be in the past.']));
    expect(homeworkDraftErrors(draft({ dueDate: '2026-13-40' }))).toContain('Due date must be a real date in YYYY-MM-DD format.');
    expect(homeworkDraftErrors(draft())).toEqual(expect.arrayContaining(['Add at least one question, or write instructions for the work.', 'Enter the total marks.']));
    expect(homeworkDraftErrors(draft({ instructions: 'Read chapter 3', totalMarks: '10' }))).toEqual([]);
  });

  test('MCQ needs two distinct options and a correct one; drafts do not need the key', () => {
    const q = { ...newQuestionDraft('MCQ'), text: 'Q', marks: '2' };
    q.options = q.options.map((option, index) => ({ ...option, text: index < 2 ? ['A', 'A'][index] : '' }));
    expect(homeworkDraftErrors(draft({ questions: [q] }))).toEqual(expect.arrayContaining(['Question 1: Options must be different from each other.', 'Question 1: Choose the correct option.']));
    const fixed = { ...q, options: q.options.map((option, index) => ({ ...option, text: index === 0 ? 'Yes' : index === 1 ? 'No' : '' })) };
    expect(homeworkDraftErrors(draft({ questions: [fixed] }), { forPublish: true })).toEqual(['Question 1: Choose the correct option.']);
    expect(homeworkDraftErrors(draft({ questions: [fixed] }), { forPublish: false })).toEqual([]);
  });

  test('true/false and one-word questions need answer keys before publishing', () => {
    const tf = { ...newQuestionDraft('TRUE_FALSE'), text: 'T', marks: '1' };
    const one = { ...newQuestionDraft('ONE_WORD_ANSWER'), text: 'W', marks: '1' };
    const errors = homeworkDraftErrors(draft({ questions: [tf, one] }));
    expect(errors).toEqual(['Question 1: Choose True or False as the answer.', 'Question 2: Enter the correct answer.']);
    expect(homeworkDraftErrors(draft({ questions: [{ ...tf, correctBool: false }, { ...one, correctText: 'Delhi' }] }))).toEqual([]);
  });

  test('marks must be positive numbers', () => {
    const q = { ...newQuestionDraft('SHORT_ANSWER'), text: 'Q', marks: '0' };
    expect(homeworkDraftErrors(draft({ questions: [q] }))).toContain('Question 1: Marks must be a number above 0.');
  });

  test('type is inferred from the questions and total marks are summed', () => {
    const obj = { ...newQuestionDraft('MCQ'), marks: '2' };
    const sub = { ...newQuestionDraft('LONG_ANSWER'), marks: '3.5' };
    expect(inferHomeworkType([])).toBe('SUBJECTIVE');
    expect(inferHomeworkType([obj])).toBe('OBJECTIVE');
    expect(inferHomeworkType([sub])).toBe('SUBJECTIVE');
    expect(inferHomeworkType([obj, sub])).toBe('MIXED');
    expect(homeworkTotalMarks(draft({ questions: [obj, sub] }))).toBe(5.5);
    expect(homeworkTotalMarks(draft({ totalMarks: '20' }))).toBe(20);
  });

  test('request body matches the backend DTO: option ids, answer keys, due date, no teacher id', () => {
    let mcq = { ...newQuestionDraft('MCQ'), text: ' Q1 ', marks: '2' };
    mcq = { ...mcq, options: mcq.options.map((option, index) => ({ ...option, text: ['4', '5', '', ''][index] })), correctOptionId: 'a' };
    const tf = { ...changeQuestionType(newQuestionDraft(), 'TRUE_FALSE'), text: 'T', marks: '1', correctBool: true };
    const request = buildHomeworkRequest(draft({ title: ' HW ', questions: [mcq, tf] }), { classId: 'c1', sectionId: 'sA' });
    expect(request).toMatchObject({ classId: 'c1', sectionId: 'sA', subjectId: 'math', title: 'HW', homeworkType: 'OBJECTIVE', totalMarks: 3 });
    expect(request.questions[0]).toMatchObject({ type: 'MCQ', questionText: 'Q1', orderIndex: 1, options: [{ id: 'a', text: '4' }, { id: 'b', text: '5' }], correctAnswer: 'a' });
    expect(request.questions[1]).toMatchObject({ type: 'TRUE_FALSE', correctAnswer: true, orderIndex: 2 });
    expect(request).not.toHaveProperty('teacherId');
    expect(request.dueDate).toBe(dueDateIso('2099-01-01'));
  });
});

function quiz(overrides: Partial<QuizDetail> = {}): QuizDetail {
  return {
    id: 'q', title: 'Quiz', description: null, status: 'DRAFT', durationMinutes: 10, totalMarks: '6', classId: 'c1', sectionId: 'sA', subjectId: 'math',
    class: { id: 'c1', name: 'Class 8' }, section: { id: 'sA', name: 'A' }, subject: { id: 'math', name: 'Math' },
    questions: [
      { id: 'a', quizId: 'q', questionText: 'Q1', questionType: 'MCQ', options: [{ id: 'a', label: 'x' }, { id: 'b', label: 'y' }], correctAnswer: 'a', marks: 2, orderIndex: 1 },
      { id: 'b', quizId: 'q', questionText: 'Q2', questionType: 'SHORT_ANSWER', options: null, correctAnswer: null, marks: 4, orderIndex: 2 },
    ],
    ...overrides,
  };
}

describe('quiz builder rules', () => {
  test('question validation per type', () => {
    expect(quizQuestionErrors(newQuizQuestionDraft('SHORT_ANSWER'))).toEqual(['Enter the question text.']);
    const mcq = { ...newQuizQuestionDraft('MCQ'), text: 'Q', marks: '2' };
    expect(quizQuestionErrors(mcq)).toEqual(expect.arrayContaining(['Add at least two options.', 'Choose the correct option.']));
    const tf = { ...newQuizQuestionDraft('TRUE_FALSE'), text: 'Q', marks: '2' };
    expect(quizQuestionErrors(tf)).toEqual(['Choose True or False as the answer.']);
    expect(quizQuestionErrors({ ...tf, correctBool: false })).toEqual([]);
  });

  test('question payload carries options only for MCQ and booleans for true/false', () => {
    const mcq = { ...newQuizQuestionDraft('MCQ'), text: 'Q', marks: '2', correctOptionId: 'b', options: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }, { id: 'c', text: '' }] };
    expect(buildQuizQuestionInput(mcq, 3)).toEqual({ questionText: 'Q', questionType: 'MCQ', marks: 2, orderIndex: 3, options: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }], correctAnswer: 'b' });
    const tf = { ...newQuizQuestionDraft('TRUE_FALSE'), text: 'Q', marks: '1', correctBool: false };
    expect(buildQuizQuestionInput(tf, 1)).toMatchObject({ questionType: 'TRUE_FALSE', correctAnswer: false });
    expect(buildQuizQuestionInput({ ...newQuizQuestionDraft('LONG_ANSWER'), text: 'Q', marks: '3' }, 2)).not.toHaveProperty('correctAnswer');
  });

  test('publishing is blocked with no questions, mismatched totals, or a non-draft', () => {
    expect(quizPublishBlockers(quiz())).toEqual([]);
    expect(quizPublishBlockers(quiz({ questions: [] }))).toEqual(['Add at least one question.']);
    expect(quizPublishBlockers(quiz({ totalMarks: '10' }))).toEqual(['Total marks (10) must equal the sum of question marks (6).']);
    expect(quizPublishBlockers(quiz({ status: 'PUBLISHED' }))).toEqual(['Only draft quizzes can be published.']);
  });

  test('quiz form validation and request', () => {
    const form = { title: ' Quiz ', description: '', scopeKey: 'k', subjectId: 'math', totalMarks: '10', durationMinutes: '30' };
    expect(quizFormErrors(form)).toEqual([]);
    expect(quizFormErrors({ ...form, title: '', totalMarks: '0', durationMinutes: '0' })).toHaveLength(3);
    expect(quizFormErrors({ ...form, durationMinutes: '2.5' })).toHaveLength(1);
    expect(buildCreateQuizRequest(form, { classId: 'c1', sectionId: 'sA' })).toEqual({ classId: 'c1', sectionId: 'sA', subjectId: 'math', title: 'Quiz', description: undefined, totalMarks: 10, durationMinutes: 30 });
  });
});
