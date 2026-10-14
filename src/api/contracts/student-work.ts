export type QuizAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EVALUATED';
export type QuizAttemptGradingStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_REVIEW'
  | 'PARTIALLY_GRADED'
  | 'GRADED';

export type HomeworkSubmissionStatus = 'SUBMITTED' | 'LATE' | 'GRADED' | 'RETURNED' | 'NOT_SUBMITTED';
export type HomeworkType = 'SUBJECTIVE' | 'OBJECTIVE' | 'MIXED';
export type HomeworkQuestionType =
  | 'MCQ'
  | 'TRUE_FALSE'
  | 'FILL_IN_THE_BLANK'
  | 'ONE_WORD_ANSWER'
  | 'SHORT_ANSWER'
  | 'LONG_ANSWER'
  | 'MATCH_THE_COLUMNS'
  | 'NUMERICAL'
  | 'DESCRIPTIVE'
  | 'ASSIGNMENT'
  | 'PRACTICE_SET';
export type HomeworkSubmissionMethod = 'PDF_UPLOAD' | 'DRIVE_LINK';
export type QuizQuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'LONG_ANSWER';
export type QuizAnswerValue = string | boolean;
export type QuizAnswerMap = Record<string, QuizAnswerValue>;

export interface SubjectSummary {
  id: string;
  name: string;
}

export interface StudentQuizAttemptSummary {
  id: string;
  status: QuizAttemptStatus;
  score: number | string | null;
  autoScore: number | string | null;
  gradingStatus: QuizAttemptGradingStatus;
  submittedAt: string | null;
  resultPublishedAt?: string | null;
}

export interface StudentQuizSummary {
  id: string;
  organizationId: string;
  teacherId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  title: string;
  description: string | null;
  totalMarks: number | string;
  durationMinutes: number;
  status: 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
  subject: SubjectSummary | null;
  attempts: StudentQuizAttemptSummary[];
}

export interface StudentQuizQuestion {
  id: string;
  questionText: string;
  questionType: QuizQuestionType | string;
  options?: QuizOption[] | Record<string, unknown> | string[] | null;
  marks: number | string;
  orderIndex: number;
  configurationError?: string | null;
}

export interface StudentQuizDetail extends StudentQuizSummary {
  questions: StudentQuizQuestion[];
}

export interface QuizOption {
  id: string;
  text?: string;
  label?: string;
  value?: string;
}

export interface StartQuizAttemptResponse {
  id: string;
  status: QuizAttemptStatus;
  score: number | string | null;
  autoScore: number | string | null;
  gradingStatus: QuizAttemptGradingStatus;
  submittedAt: string | null;
}

export interface SubmitQuizAttemptRequest {
  answers: QuizAnswerMap;
}

export interface QuizAttemptResultAnswer {
  answerId?: string;
  questionId: string;
  questionNumber?: number;
  questionText?: string;
  questionType?: string;
  maxMarks?: number | string;
  options?: QuizOption[] | null;
  submittedAnswer?: unknown;
  expectedAnswer?: unknown;
  isCorrect?: boolean | null;
  awardedMarks?: number | string | null;
  teacherFeedback?: string | null;
  gradingStatus?: string;
  needsManualReview?: boolean;
}

export interface QuizAttemptResult {
  id?: string;
  status?: QuizAttemptStatus;
  gradingStatus?: QuizAttemptGradingStatus;
  submittedAt?: string | null;
  gradedAt?: string | null;
  resultPublishedAt?: string | null;
  score?: number | string | null;
  autoScore?: number | string | null;
  maxScore?: number | string | null;
  percentage?: number | string | null;
  overallFeedback?: string | null;
  pendingReview?: boolean;
  pendingMessage?: string | null;
  quiz?: Pick<StudentQuizDetail, 'id' | 'title' | 'totalMarks'>;
  attempt?: StudentQuizAttemptSummary;
  answers?: QuizAttemptResultAnswer[];
}

export interface StudentHomeworkSummary {
  id: string;
  title: string;
  subject: SubjectSummary | null;
  homeworkType: HomeworkType;
  questionCount: number;
  totalMarks: number | null;
  dueDate: string;
  submissionStatus: HomeworkSubmissionStatus;
}

export interface StudentHomeworkQuestion {
  id: string;
  type: HomeworkQuestionType;
  questionText: string;
  description: string | null;
  marks: number;
  order: number;
  required: boolean;
  options?: { id: string; text: string }[];
  leftItems?: { id: string; text: string }[];
  rightItems?: { id: string; text: string }[];
}

export interface StudentHomeworkDetail extends Omit<StudentHomeworkSummary, 'questionCount' | 'submissionStatus'> {
  description: string | null;
  instructions: string | null;
  class: { id: string; name: string };
  section: { id: string; name: string };
  questions: StudentHomeworkQuestion[];
  legacyContent: null;
  submission: {
    id: string;
    status: HomeworkSubmissionStatus;
    submissionMethod: string | null;
    driveUrl: string | null;
    fileUrl: string | null;
    originalFileName: string | null;
    objectiveScore: number | null;
    submittedAt: string | null;
    answers: { questionId: string; answerJson: unknown }[];
  } | null;
}

export interface SubmitHomeworkAnswer {
  questionId: string;
  type: HomeworkQuestionType;
  selectedOptionId?: string;
  value?: boolean;
  text?: string;
  matches?: Record<string, string>;
}

export interface SubmitHomeworkRequest {
  submissionText?: string;
  fileUrl?: string;
  submissionMethod?: HomeworkSubmissionMethod;
  driveUrl?: string;
  objectiveAnswers: SubmitHomeworkAnswer[];
  file?: {
    uri: string;
    name: string;
    type: string;
  };
}
