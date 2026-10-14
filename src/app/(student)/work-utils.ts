import type {
  StudentHomeworkSummary,
  StudentHomeworkQuestion,
  QuizOption,
  StudentQuizAttemptSummary,
  StudentQuizQuestion,
  StudentQuizSummary,
} from '@/api/contracts/student-work';

export type WorkStatusTone = 'success' | 'warning' | 'danger' | 'muted' | 'info';

export interface WorkStatusPresentation {
  label: string;
  tone: WorkStatusTone;
}

export type QuizLifecycleState =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED_PENDING_REVIEW'
  | 'RESULT_RELEASED';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateTime(value?: string | null) {
  const date = parseDate(value);
  if (!date) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function daysUntil(value?: string | null, now = new Date()) {
  const date = parseDate(value);
  if (!date) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.ceil((target - start) / MS_PER_DAY);
}

export function latestQuizAttempt(quiz: StudentQuizSummary): StudentQuizAttemptSummary | null {
  return quiz.attempts?.[0] ?? null;
}

export function quizLifecycleState(quiz: Pick<StudentQuizSummary, 'attempts'>): QuizLifecycleState {
  const attempt = latestQuizAttempt(quiz as StudentQuizSummary);
  if (!attempt) return 'NOT_STARTED';
  if (attempt.status === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (attempt.status === 'EVALUATED' || attempt.gradingStatus === 'GRADED') return 'RESULT_RELEASED';
  return 'SUBMITTED_PENDING_REVIEW';
}

export function quizStatus(quiz: StudentQuizSummary): WorkStatusPresentation {
  const state = quizLifecycleState(quiz);
  if (state === 'NOT_STARTED') return { label: 'Not started', tone: 'info' };
  if (state === 'IN_PROGRESS') return { label: 'In progress', tone: 'warning' };
  if (state === 'RESULT_RELEASED') return { label: 'Result released', tone: 'success' };
  return { label: 'Awaiting review', tone: 'warning' };
}

export function isFinalQuizAttempt(attempt?: StudentQuizAttemptSummary | null) {
  return attempt?.status === 'SUBMITTED' || attempt?.status === 'EVALUATED';
}

export function resultScoreText(result: { score?: number | string | null; maxScore?: number | string | null; percentage?: number | string | null }) {
  if (result.score === null || result.score === undefined) return null;
  const base = result.maxScore !== null && result.maxScore !== undefined ? `${result.score}/${result.maxScore}` : `${result.score}`;
  return result.percentage !== null && result.percentage !== undefined ? `${base} (${result.percentage}%)` : base;
}

export function homeworkAnswerToText(answer: unknown) {
  if (!answer || typeof answer !== 'object') return '';
  const record = answer as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.selectedOptionId === 'string') return record.selectedOptionId;
  if (typeof record.value === 'boolean') return record.value ? 'True' : 'False';
  if (record.matches && typeof record.matches === 'object') {
    return Object.entries(record.matches as Record<string, unknown>)
      .map(([left, right]) => `${left}: ${String(right)}`)
      .join(', ');
  }
  return '';
}

export function homeworkStatus(homework: StudentHomeworkSummary, now = new Date()): WorkStatusPresentation {
  if (homework.submissionStatus === 'GRADED') return { label: 'Graded', tone: 'success' };
  if (homework.submissionStatus === 'SUBMITTED' || homework.submissionStatus === 'LATE') {
    return { label: homework.submissionStatus === 'LATE' ? 'Submitted late' : 'Pending review', tone: 'warning' };
  }
  const remaining = daysUntil(homework.dueDate, now);
  if (remaining !== null && remaining < 0) return { label: 'Overdue', tone: 'danger' };
  if (remaining !== null && remaining <= 2) return { label: 'Due soon', tone: 'warning' };
  return { label: 'Not submitted', tone: 'info' };
}

const blockedKeys = new Set(['answer', 'answers', 'answerKey', 'correctAnswer', 'correctAnswers', 'rubric', 'grading', 'gradingMetadata']);

export function safeDisplayText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseMaybeJson(trimmed);
  if (!parsed) return trimmed;
  const text = extractDocumentedText(parsed);
  if (text) return text;
  return 'This legacy content could not be displayed safely. Ask your teacher to republish the assignment with student-facing instructions.';
}

export function homeworkQuestionText(question: StudentHomeworkQuestion) {
  return safeDisplayText(question.questionText) ?? 'Question text is unavailable.';
}

export function homeworkQuestionDescription(question: StudentHomeworkQuestion) {
  return safeDisplayText(question.description);
}

export function normalizeQuizOptions(question: StudentQuizQuestion): QuizOption[] {
  const raw = question.options;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => normalizeOptionItem(item, index))
      .filter((option): option is QuizOption => Boolean(option));
  }
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([key]) => !blockedKeys.has(key))
      .map(([key, value], index) => normalizeOptionItem({ id: key, text: value }, index))
      .filter((option): option is QuizOption => Boolean(option));
  }
  return [];
}

function normalizeOptionItem(item: unknown, index: number): QuizOption | null {
  if (typeof item === 'string') return { id: item, text: item };
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const id = stringValue(record.id) ?? stringValue(record.value) ?? String(index);
  const text = stringValue(record.text) ?? stringValue(record.label) ?? stringValue(record.value);
  if (!text) return null;
  return { id, text };
}

function parseMaybeJson(value: string) {
  if (!value.startsWith('{') && !value.startsWith('[')) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { malformed: true };
  }
}

function extractDocumentedText(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => blockedKeys.has(key))) return null;
  const candidates = ['instructions', 'instruction', 'description', 'questionText', 'question', 'prompt', 'text'];
  for (const key of candidates) {
    const text = stringValue(record[key]);
    if (text) return text;
  }
  return null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
