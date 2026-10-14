import type {
  HomeworkQuestionType,
  HomeworkSubmissionMethod,
  StudentHomeworkDetail,
  StudentHomeworkQuestion,
  SubmitHomeworkAnswer,
  SubmitHomeworkRequest,
} from '@/api/contracts/student-work';
import type { UploadDescriptor } from '@/files/uploads';
import { createMultipartFile } from '@/files/uploads';
import { homeworkQuestionText } from './work-utils';

export type AnswerValue = string | boolean | Record<string, string>;

export interface SubmissionInputs {
  answers: Record<string, AnswerValue>;
  submissionMethod?: HomeworkSubmissionMethod;
  driveUrl?: string;
  submissionText?: string;
  file?: UploadDescriptor | null;
}

export const OBJECTIVE_TYPES = new Set<HomeworkQuestionType>(['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'ONE_WORD_ANSWER', 'MATCH_THE_COLUMNS']);
export const SUBJECTIVE_TYPES = new Set<HomeworkQuestionType>(['SHORT_ANSWER', 'LONG_ANSWER', 'NUMERICAL', 'DESCRIPTIVE', 'ASSIGNMENT', 'PRACTICE_SET']);
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
// Mirrors SubmitHomeworkDto.submissionText @MaxLength(10000).
export const MAX_SUBMISSION_TEXT = 10000;

export function homeworkNeedsSubjective(homework: Pick<StudentHomeworkDetail, 'questions' | 'homeworkType'>) {
  return homework.questions.some((question) => SUBJECTIVE_TYPES.has(question.type)) || homework.homeworkType !== 'OBJECTIVE';
}

export function isMatches(value: unknown): value is Record<string, string> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function hasHomeworkAnswer(question: StudentHomeworkQuestion, value: AnswerValue | undefined) {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.trim().length > 0;
  if (isMatches(value)) return (question.leftItems ?? []).every((left) => Boolean(value[left.id]));
  return false;
}

export function buildObjectiveAnswers(questions: StudentHomeworkQuestion[], answers: Record<string, AnswerValue>): SubmitHomeworkAnswer[] {
  return questions.filter((question) => OBJECTIVE_TYPES.has(question.type) && hasHomeworkAnswer(question, answers[question.id])).map((question) => {
    const value = answers[question.id];
    if (question.type === 'MCQ') return { questionId: question.id, type: question.type, selectedOptionId: String(value) };
    if (question.type === 'TRUE_FALSE') return { questionId: question.id, type: question.type, value: Boolean(value) };
    if (question.type === 'MATCH_THE_COLUMNS') return { questionId: question.id, type: question.type, matches: isMatches(value) ? value : {} };
    return { questionId: question.id, type: question.type, text: String(value ?? '') };
  });
}

export function buildSubmissionText(questions: StudentHomeworkQuestion[], answers: Record<string, AnswerValue>, note: string) {
  const subjective = questions.filter((question) => SUBJECTIVE_TYPES.has(question.type) && hasHomeworkAnswer(question, answers[question.id])).map((question) => `${homeworkQuestionText(question)}\n${String(answers[question.id])}`);
  return [note.trim(), ...subjective].filter(Boolean).join('\n\n');
}

/**
 * The attachment that will actually be sent. A method chosen without its
 * content (Drive with a blank URL, PDF without a file) is not an attachment,
 * so written-only submissions never carry a dangling submissionMethod, which
 * the backend rejects.
 */
export function resolveAttachment(inputs: Pick<SubmissionInputs, 'submissionMethod' | 'driveUrl' | 'file'>):
  | { method: 'PDF_UPLOAD'; file: UploadDescriptor }
  | { method: 'DRIVE_LINK'; driveUrl: string }
  | null {
  if (inputs.submissionMethod === 'PDF_UPLOAD' && inputs.file) return { method: 'PDF_UPLOAD', file: inputs.file };
  if (inputs.submissionMethod === 'DRIVE_LINK' && inputs.driveUrl?.trim()) return { method: 'DRIVE_LINK', driveUrl: inputs.driveUrl.trim() };
  return null;
}

export function validateHomework(homework: StudentHomeworkDetail, inputs: SubmissionInputs) {
  for (const question of homework.questions) {
    if (question.required && !hasHomeworkAnswer(question, inputs.answers[question.id])) return `Please answer Question ${question.order}.`;
  }
  const text = buildSubmissionText(homework.questions, inputs.answers, inputs.submissionText ?? '');
  if (text.length > MAX_SUBMISSION_TEXT) return `Your written response is too long (${text.length} of ${MAX_SUBMISSION_TEXT} characters). Please shorten it or attach a PDF instead.`;
  const attachment = resolveAttachment(inputs);
  if (inputs.submissionMethod === 'DRIVE_LINK' && inputs.driveUrl?.trim()) {
    const driveError = validateDriveUrl(inputs.driveUrl.trim());
    if (driveError) return driveError;
  }
  if (!homeworkNeedsSubjective(homework)) return null;
  if (!text && !attachment) return 'Please write your response, attach a PDF, or add a Google Drive link.';
  return null;
}

export function buildSubmitPayload(homework: StudentHomeworkDetail, inputs: SubmissionInputs): SubmitHomeworkRequest {
  const attachment = resolveAttachment(inputs);
  return {
    objectiveAnswers: buildObjectiveAnswers(homework.questions, inputs.answers),
    submissionText: buildSubmissionText(homework.questions, inputs.answers, inputs.submissionText ?? '') || undefined,
    submissionMethod: attachment?.method,
    driveUrl: attachment?.method === 'DRIVE_LINK' ? attachment.driveUrl : undefined,
    file: attachment?.method === 'PDF_UPLOAD' ? createMultipartFile(attachment.file) : undefined,
  };
}

export function validatePdf(file: UploadDescriptor) {
  if (file.size && file.size > MAX_PDF_BYTES) return 'PDF upload must be 10 MB or smaller.';
  if (file.mimeType !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) return 'Only PDF files are supported.';
  return null;
}

export function validateDriveUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return 'Drive link must use http or https.';
    if (url.hostname !== 'drive.google.com' && url.hostname !== 'docs.google.com') return 'Only Google Drive or Google Docs links are supported.';
    return null;
  } catch {
    return 'Drive link must be a valid URL.';
  }
}

/** True when the server may or may not have recorded the submission. */
export function isUncertainSubmitOutcome(error: { status?: number }) {
  return error.status === undefined || error.status === 408 || error.status === 409 || error.status >= 500;
}
