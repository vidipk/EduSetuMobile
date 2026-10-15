import type {
  AttendanceStatus,
  CreateQuizRequest,
  DecimalLike,
  HomeworkQuestionInput,
  HomeworkQuestionType,
  HomeworkType,
  QuizDetail,
  QuizQuestionInput,
  QuizQuestionType,
  RosterStudent,
  SaveHomeworkRequest,
  TeacherAssignment,
  TeacherProfile,
} from '@/api/contracts/teacher-ops';

// ---------------------------------------------------------------- numbers/dates

export function toNumber(value: DecimalLike | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function toDateString(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayString(now = new Date()) {
  return toDateString(now);
}

export function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  return toDateString(new Date(year, month - 1, day + days));
}

export function isValidDateString(value: string) {
  if (!DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Homework is due at the end of the chosen local day. */
export function dueDateIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 0, 0).toISOString();
}

export function displayDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: DATE_ONLY.test(value) ? undefined : 'UTC' }).format(date);
}

export function displayDateTime(value: string | null | undefined) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}

// -------------------------------------------------------------------- marks

export type MarksResult = { ok: true; value: number } | { ok: false; error: string };

/** Client-side guard only; the backend remains authoritative. */
export function validateMarks(text: string, max: number | null): MarksResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Enter marks.' };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false, error: 'Marks must be a number with at most two decimals.' };
  const value = Number(trimmed);
  if (max !== null && value > max) return { ok: false, error: `Marks cannot exceed ${trimNumber(max)}.` };
  return { ok: true, value };
}

// -------------------------------------------------------------- assignments

export function activeAssignments(profile: TeacherProfile | null, academicYearId?: string | null) {
  if (!profile) return [];
  if (academicYearId) return profile.assignments.filter((assignment) => assignment.academicYear.id === academicYearId);
  const active = profile.assignments.filter((assignment) => assignment.academicYear.isActive);
  return active.length ? active : profile.assignments;
}

export interface SectionScope {
  key: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
  label: string;
  subjects: { id: string; name: string }[];
}

export function sectionScopes(assignments: TeacherAssignment[]): SectionScope[] {
  const map = new Map<string, SectionScope>();
  for (const assignment of assignments) {
    const key = `${assignment.classId}:${assignment.sectionId}:${assignment.academicYear.id}`;
    const scope = map.get(key) ?? { key, classId: assignment.classId, sectionId: assignment.sectionId, academicYearId: assignment.academicYear.id, label: `${assignment.className} ${assignment.sectionName}`, subjects: [] };
    if (!scope.subjects.some((subject) => subject.id === assignment.subjectId)) scope.subjects.push({ id: assignment.subjectId, name: assignment.subjectName });
    map.set(key, scope);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function academicYears(profile: TeacherProfile | null) {
  const map = new Map<string, { id: string; name: string; isActive: boolean }>();
  for (const assignment of profile?.assignments ?? []) map.set(assignment.academicYear.id, assignment.academicYear);
  return [...map.values()].sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.name.localeCompare(a.name));
}

// --------------------------------------------------------------- attendance

export type EditMap = Record<string, AttendanceStatus>;

export function effectiveStatus(student: RosterStudent, edits: EditMap): AttendanceStatus {
  return edits[student.studentId] ?? student.status;
}

export function attendanceCounts(students: RosterStudent[], edits: EditMap) {
  let present = 0;
  let absent = 0;
  for (const student of students) {
    if (effectiveStatus(student, edits) === 'PRESENT') present += 1;
    else absent += 1;
  }
  return { present, absent, total: students.length };
}

/** True when any local edit differs from what the server currently holds. */
export function hasUnsavedChanges(students: RosterStudent[], edits: EditMap) {
  return students.some((student) => edits[student.studentId] !== undefined && edits[student.studentId] !== student.status);
}

export function buildRecordSnapshot(students: RosterStudent[], edits: EditMap) {
  return students.map((student) => ({ studentId: student.studentId, status: effectiveStatus(student, edits) }));
}

// ----------------------------------------------------------------- homework

export const HOMEWORK_QUESTION_TYPES: { id: HomeworkQuestionType; label: string }[] = [
  { id: 'MCQ', label: 'Multiple choice' },
  { id: 'TRUE_FALSE', label: 'True / False' },
  { id: 'ONE_WORD_ANSWER', label: 'One word' },
  { id: 'FILL_IN_THE_BLANK', label: 'Fill in the blank' },
  { id: 'SHORT_ANSWER', label: 'Short answer' },
  { id: 'LONG_ANSWER', label: 'Long answer' },
];

const OBJECTIVE = new Set<string>(['MCQ', 'TRUE_FALSE', 'ONE_WORD_ANSWER', 'FILL_IN_THE_BLANK', 'MATCH_THE_COLUMNS']);

export interface OptionDraft { id: string; text: string }

export interface QuestionDraft {
  key: string;
  type: HomeworkQuestionType;
  text: string;
  marks: string;
  options: OptionDraft[];
  correctOptionId: string;
  correctBool: boolean | null;
  correctText: string;
}

export interface HomeworkDraft {
  title: string;
  description: string;
  instructions: string;
  scopeKey: string;
  subjectId: string;
  dueDate: string;
  totalMarks: string;
  questions: QuestionDraft[];
}

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
let questionCounter = 0;

export function newOptions(count = 2): OptionDraft[] {
  return OPTION_IDS.slice(0, count).map((id) => ({ id, text: '' }));
}

export function newQuestionDraft(type: HomeworkQuestionType = 'MCQ'): QuestionDraft {
  questionCounter += 1;
  return { key: `q${questionCounter}`, type, text: '', marks: '1', options: type === 'MCQ' ? newOptions(4) : [], correctOptionId: '', correctBool: null, correctText: '' };
}

export function changeQuestionType(question: QuestionDraft, type: HomeworkQuestionType): QuestionDraft {
  return { ...question, type, options: type === 'MCQ' ? (question.options.length >= 2 ? question.options : newOptions(4)) : [], correctOptionId: '', correctBool: null, correctText: '' };
}

export function inferHomeworkType(questions: Pick<QuestionDraft, 'type'>[]): HomeworkType {
  if (!questions.length) return 'SUBJECTIVE';
  const objective = questions.filter((question) => OBJECTIVE.has(question.type)).length;
  if (objective === questions.length) return 'OBJECTIVE';
  if (objective === 0) return 'SUBJECTIVE';
  return 'MIXED';
}

function parseQuestionMarks(text: string) {
  const result = validateMarks(text, 1000);
  return result.ok && result.value > 0 ? result.value : null;
}

export function questionErrors(question: QuestionDraft, forPublish = true): string[] {
  const errors: string[] = [];
  if (!question.text.trim()) errors.push('Enter the question text.');
  if (parseQuestionMarks(question.marks) === null) errors.push('Marks must be a number above 0.');
  if (question.type === 'MCQ') {
    const filled = question.options.filter((option) => option.text.trim());
    if (filled.length < 2) errors.push('Add at least two options.');
    const labels = filled.map((option) => option.text.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) errors.push('Options must be different from each other.');
    if (forPublish && !filled.some((option) => option.id === question.correctOptionId)) errors.push('Choose the correct option.');
  }
  if (question.type === 'TRUE_FALSE' && forPublish && question.correctBool === null) errors.push('Choose True or False as the answer.');
  if ((question.type === 'ONE_WORD_ANSWER' || question.type === 'FILL_IN_THE_BLANK') && forPublish && !question.correctText.trim()) errors.push('Enter the correct answer.');
  return errors;
}

export function homeworkDraftErrors(draft: HomeworkDraft, options: { now?: Date; requireFutureDue?: boolean; forPublish?: boolean } = {}): string[] {
  const errors: string[] = [];
  const forPublish = options.forPublish ?? true;
  if (!draft.title.trim()) errors.push('Enter a title.');
  if (draft.title.trim().length > 255) errors.push('Title must be 255 characters or fewer.');
  if (!draft.scopeKey) errors.push('Choose a class and section.');
  if (!draft.subjectId) errors.push('Choose a subject.');
  if (!isValidDateString(draft.dueDate)) errors.push('Due date must be a real date in YYYY-MM-DD format.');
  else if (options.requireFutureDue && draft.dueDate < todayString(options.now)) errors.push('Due date cannot be in the past.');
  if (!draft.questions.length) {
    if (!draft.instructions.trim() && !draft.description.trim()) errors.push('Add at least one question, or write instructions for the work.');
    const total = validateMarks(draft.totalMarks, null);
    if (!total.ok || total.value <= 0) errors.push('Enter the total marks.');
  }
  draft.questions.forEach((question, index) => {
    for (const message of questionErrors(question, forPublish)) errors.push(`Question ${index + 1}: ${message}`);
  });
  return errors;
}

export function homeworkTotalMarks(draft: HomeworkDraft) {
  if (!draft.questions.length) {
    const result = validateMarks(draft.totalMarks, null);
    return result.ok ? result.value : 0;
  }
  return draft.questions.reduce((sum, question) => sum + (parseQuestionMarks(question.marks) ?? 0), 0);
}

export function buildHomeworkRequest(draft: HomeworkDraft, scope: { classId: string; sectionId: string }): SaveHomeworkRequest {
  const questions: HomeworkQuestionInput[] = draft.questions.map((question, index) => {
    const input: HomeworkQuestionInput = { type: question.type, questionText: question.text.trim(), marks: parseQuestionMarks(question.marks) ?? 0, orderIndex: index + 1, required: true };
    if (question.type === 'MCQ') {
      input.options = question.options.filter((option) => option.text.trim()).map((option) => ({ id: option.id, text: option.text.trim() }));
      if (question.correctOptionId) input.correctAnswer = question.correctOptionId;
    }
    if (question.type === 'TRUE_FALSE' && question.correctBool !== null) input.correctAnswer = question.correctBool;
    if ((question.type === 'ONE_WORD_ANSWER' || question.type === 'FILL_IN_THE_BLANK') && question.correctText.trim()) input.correctAnswer = question.correctText.trim();
    return input;
  });
  return {
    classId: scope.classId,
    sectionId: scope.sectionId,
    subjectId: draft.subjectId,
    title: draft.title.trim(),
    description: draft.description.trim() || undefined,
    instructions: draft.instructions.trim() || undefined,
    homeworkType: inferHomeworkType(draft.questions),
    totalMarks: homeworkTotalMarks(draft),
    dueDate: dueDateIso(draft.dueDate),
    questions,
  };
}

// ------------------------------------------------------------------- quizzes

export const QUIZ_QUESTION_TYPES: { id: QuizQuestionType; label: string }[] = [
  { id: 'MCQ', label: 'Multiple choice' },
  { id: 'TRUE_FALSE', label: 'True / False' },
  { id: 'SHORT_ANSWER', label: 'Short answer' },
  { id: 'LONG_ANSWER', label: 'Long answer' },
];

export interface QuizQuestionDraft {
  type: QuizQuestionType;
  text: string;
  marks: string;
  options: OptionDraft[];
  correctOptionId: string;
  correctBool: boolean | null;
}

export function newQuizQuestionDraft(type: QuizQuestionType = 'MCQ'): QuizQuestionDraft {
  return { type, text: '', marks: '1', options: type === 'MCQ' ? newOptions(4) : [], correctOptionId: '', correctBool: null };
}

export function changeQuizQuestionType(question: QuizQuestionDraft, type: QuizQuestionType): QuizQuestionDraft {
  return { ...question, type, options: type === 'MCQ' ? (question.options.length >= 2 ? question.options : newOptions(4)) : [], correctOptionId: '', correctBool: null };
}

export function quizQuestionErrors(question: QuizQuestionDraft): string[] {
  const errors: string[] = [];
  if (!question.text.trim()) errors.push('Enter the question text.');
  if (parseQuestionMarks(question.marks) === null) errors.push('Marks must be a number above 0.');
  if (question.type === 'MCQ') {
    const filled = question.options.filter((option) => option.text.trim());
    if (filled.length < 2) errors.push('Add at least two options.');
    const labels = filled.map((option) => option.text.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) errors.push('Options must be different from each other.');
    if (!filled.some((option) => option.id === question.correctOptionId)) errors.push('Choose the correct option.');
  }
  if (question.type === 'TRUE_FALSE' && question.correctBool === null) errors.push('Choose True or False as the answer.');
  return errors;
}

export function buildQuizQuestionInput(question: QuizQuestionDraft, orderIndex: number): QuizQuestionInput {
  const input: QuizQuestionInput = { questionText: question.text.trim(), questionType: question.type, marks: parseQuestionMarks(question.marks) ?? 0, orderIndex };
  if (question.type === 'MCQ') {
    input.options = question.options.filter((option) => option.text.trim()).map((option) => ({ id: option.id, text: option.text.trim() }));
    input.correctAnswer = question.correctOptionId;
  }
  if (question.type === 'TRUE_FALSE' && question.correctBool !== null) input.correctAnswer = question.correctBool;
  return input;
}

export function quizQuestionToDraft(question: QuizDetail['questions'][number]): QuizQuestionDraft {
  const options = (question.options ?? []).map((option) => ({ id: option.id, text: option.label ?? option.text ?? '' }));
  return {
    type: question.questionType,
    text: question.questionText,
    marks: trimNumber(Number(question.marks)),
    options: question.questionType === 'MCQ' ? [...options, ...newOptions(6).filter((candidate) => !options.some((option) => option.id === candidate.id)).slice(0, Math.max(0, 4 - options.length))] : [],
    correctOptionId: question.questionType === 'MCQ' && typeof question.correctAnswer === 'string' ? question.correctAnswer : '',
    correctBool: question.questionType === 'TRUE_FALSE' ? (question.correctAnswer === true || question.correctAnswer === 'true' ? true : question.correctAnswer === false || question.correctAnswer === 'false' ? false : null) : null,
  };
}

export function nextOrderIndex(quiz: Pick<QuizDetail, 'questions'>) {
  return quiz.questions.reduce((max, question) => Math.max(max, question.orderIndex), 0) + 1;
}

export function quizSumMarks(quiz: Pick<QuizDetail, 'questions'>) {
  return Math.round(quiz.questions.reduce((sum, question) => sum + Number(question.marks), 0) * 100) / 100;
}

/** Reasons a quiz cannot be published yet (the backend re-validates). */
export function quizPublishBlockers(quiz: QuizDetail): string[] {
  const blockers: string[] = [];
  if (quiz.status !== 'DRAFT') blockers.push('Only draft quizzes can be published.');
  if (!quiz.questions.length) blockers.push('Add at least one question.');
  const total = toNumber(quiz.totalMarks);
  if (quiz.questions.length && total !== null && Math.abs(total - quizSumMarks(quiz)) > 0.001) {
    blockers.push(`Total marks (${trimNumber(total)}) must equal the sum of question marks (${trimNumber(quizSumMarks(quiz))}).`);
  }
  return blockers;
}

export interface QuizFormInput {
  title: string;
  description: string;
  scopeKey: string;
  subjectId: string;
  totalMarks: string;
  durationMinutes: string;
}

export function quizFormErrors(input: QuizFormInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Enter a title.');
  if (!input.scopeKey) errors.push('Choose a class and section.');
  if (!input.subjectId) errors.push('Choose a subject.');
  const total = validateMarks(input.totalMarks, null);
  if (!total.ok || total.value <= 0) errors.push('Total marks must be above 0.');
  if (!/^\d+$/.test(input.durationMinutes.trim()) || Number(input.durationMinutes) < 1 || Number(input.durationMinutes) > 600) errors.push('Duration must be a whole number of minutes (1–600).');
  return errors;
}

export function buildCreateQuizRequest(input: QuizFormInput, scope: { classId: string; sectionId: string }): CreateQuizRequest {
  return {
    classId: scope.classId,
    sectionId: scope.sectionId,
    subjectId: input.subjectId,
    title: input.title.trim(),
    description: input.description.trim() || undefined,
    totalMarks: Number(input.totalMarks),
    durationMinutes: Number(input.durationMinutes),
  };
}

// ------------------------------------------------------------------- labels

export function statusTone(status: string): 'success' | 'warning' | 'info' | 'muted' | 'danger' {
  if (['SUBMITTED', 'PUBLISHED', 'GRADED', 'EVALUATED'].includes(status)) return 'success';
  if (['DRAFT', 'PENDING_REVIEW', 'PARTIALLY_GRADED', 'LATE'].includes(status)) return 'warning';
  if (['IN_PROGRESS'].includes(status)) return 'info';
  return 'muted';
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = { DRAFT: 'Draft', SUBMITTED: 'Submitted', PUBLISHED: 'Published', CLOSED: 'Closed', ARCHIVED: 'Archived', GRADED: 'Graded', LATE: 'Submitted late', PENDING_REVIEW: 'Needs review', PARTIALLY_GRADED: 'Partly graded', EVALUATED: 'Evaluated', IN_PROGRESS: 'In progress', NOT_REQUIRED: 'Auto-graded', RETURNED: 'Returned' };
  return labels[status] ?? status.replace(/_/g, ' ').toLowerCase();
}
