// Mirrors the backend teacher-facing endpoints (profile, attendance, homework, quizzes).
// Decimal columns arrive as strings on some endpoints and numbers on others: use `toNumber`.

export type DecimalLike = string | number | null;

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface NamedRef {
  id: string;
  name: string;
}

// ------------------------------------------------------------------ profile

export interface TeacherAssignment {
  assignmentId: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  subjectId: string;
  subjectName: string;
  academicYear: { id: string; name: string; isActive: boolean };
}

export interface TeacherProfile {
  id: string;
  teacherCode: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  organization: { id: string; name: string };
  assignments: TeacherAssignment[];
}

// --------------------------------------------------------------- attendance

export type AttendanceStatus = 'PRESENT' | 'ABSENT';
export type AttendanceSessionStatus = 'DRAFT' | 'SUBMITTED';

export interface AttendanceActor {
  id: string;
  fullName: string | null;
  role: string;
}

export interface AttendanceSessionSummary {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  date: string;
  status: AttendanceSessionStatus;
  submittedAt: string | null;
  class: NamedRef;
  section: NamedRef;
  subject: NamedRef | null;
  _count?: { records: number };
  takenBy?: AttendanceActor | null;
  submittedBy?: AttendanceActor | null;
}

export interface RosterStudent {
  studentId: string;
  recordId: string | null;
  rollNumber: string | null;
  fullName: string;
  status: AttendanceStatus;
  remarks: string;
}

export interface AttendanceRoster {
  date: string;
  session: (AttendanceSessionSummary & { records: { id: string; studentId: string; status: AttendanceStatus; remarks: string | null }[] }) | null;
  locked: boolean;
  students: RosterStudent[];
}

export interface AttendanceSessionDetail extends AttendanceSessionSummary {
  records: { id: string; studentId: string; status: AttendanceStatus; remarks: string | null; student?: { rollNumber: string | null; user?: { fullName: string } } }[];
}

export interface AttendanceScopeQuery {
  classId: string;
  sectionId: string;
  date: string;
  academicYearId?: string;
}

export interface AttendanceSessionsQuery {
  classId?: string;
  sectionId?: string;
  academicYearId?: string;
  status?: AttendanceSessionStatus;
  date?: string;
  page?: number;
  limit?: number;
}

// ----------------------------------------------------------------- homework

export type HomeworkStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
export type HomeworkType = 'OBJECTIVE' | 'SUBJECTIVE' | 'MIXED';
export type HomeworkQuestionType = 'MCQ' | 'TRUE_FALSE' | 'FILL_IN_THE_BLANK' | 'ONE_WORD_ANSWER' | 'SHORT_ANSWER' | 'LONG_ANSWER' | 'MATCH_THE_COLUMNS' | 'NUMERICAL' | 'DESCRIPTIVE' | 'ASSIGNMENT' | 'PRACTICE_SET';
export type HomeworkSubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'LATE' | 'GRADED' | 'RETURNED';

export interface HomeworkListItem {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  homeworkType: HomeworkType;
  totalMarks: DecimalLike;
  dueDate: string;
  status: HomeworkStatus;
  publishedAt: string | null;
  classId: string;
  sectionId: string;
  subjectId: string;
  class: { id: string; name: string };
  section: { id: string; name: string };
  subject: { id: string; name: string };
  _count: { submissions: number };
}

export interface TeacherHomeworkQuestion {
  id: string;
  type: HomeworkQuestionType;
  questionText: string;
  description: string | null;
  marks: number;
  order: number;
  required: boolean;
  options?: { id: string; text?: string; label?: string }[];
  correctAnswer?: unknown;
  explanation?: string | null;
}

export interface HomeworkDetail extends HomeworkListItem {
  questions: TeacherHomeworkQuestion[];
}

export interface HomeworkQuestionInput {
  type: HomeworkQuestionType;
  questionText: string;
  marks: number;
  orderIndex: number;
  required?: boolean;
  options?: { id: string; text: string }[];
  correctAnswer?: string | boolean;
}

export interface SaveHomeworkRequest {
  classId: string;
  sectionId: string;
  subjectId: string;
  title: string;
  description?: string;
  instructions?: string;
  homeworkType: HomeworkType;
  totalMarks: number;
  dueDate: string;
  questions: HomeworkQuestionInput[];
}

export interface HomeworkSubmissionRecord {
  id: string;
  homeworkId: string;
  studentId: string;
  submissionText: string | null;
  fileUrl: string | null;
  submissionMethod: 'PDF_UPLOAD' | 'DRIVE_LINK' | null;
  originalFileName: string | null;
  driveUrl: string | null;
  objectiveScore: DecimalLike;
  status: HomeworkSubmissionStatus;
  marks: DecimalLike;
  feedback: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  student: { id: string; rollNumber: string | null; admissionNumber?: string; user: { fullName: string } };
}

export interface HomeworkListQuery {
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  status?: HomeworkStatus;
  page?: number;
  limit?: number;
}

export interface SubmissionAnswerDetail {
  questionId: string;
  order: number;
  type: HomeworkQuestionType;
  questionText: string;
  maxMarks: number;
  answerText: string | null;
  expectedAnswer: string | null;
  awardedMarks: number | null;
  autoGraded: boolean;
  isCorrect: boolean | null;
}

export interface HomeworkSubmissionDetail {
  id: string;
  homework: { id: string; title: string; homeworkType: HomeworkType; totalMarks: number | null };
  student: { id: string; fullName: string; rollNumber: string | null; admissionNumber: string | null };
  status: HomeworkSubmissionStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  submissionText: string | null;
  submissionMethod: 'PDF_UPLOAD' | 'DRIVE_LINK' | null;
  driveUrl: string | null;
  originalFileName: string | null;
  fileSizeBytes: number | null;
  /** True when an uploaded PDF exists and can be downloaded through the authenticated file endpoint. */
  fileAvailable: boolean;
  objectiveScore: number | null;
  marks: number | null;
  feedback: string | null;
  answers: SubmissionAnswerDetail[];
}

// ------------------------------------------------------------------ quizzes

export type QuizStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type QuizQuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'LONG_ANSWER';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EVALUATED';
export type AttemptGradingStatus = 'NOT_REQUIRED' | 'PENDING_REVIEW' | 'PARTIALLY_GRADED' | 'GRADED';

export interface QuizListItem {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  subject: NamedRef | null;
  class: NamedRef | null;
  section: NamedRef | null;
  _count: { questions: number; attempts: number };
}

export interface TeacherQuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  questionType: QuizQuestionType;
  options: { id: string; label?: string; text?: string }[] | null;
  correctAnswer: unknown;
  marks: number;
  orderIndex: number;
}

export interface QuizDetail {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  durationMinutes: number;
  totalMarks: DecimalLike;
  classId: string;
  sectionId: string;
  subjectId: string;
  class: { id: string; name: string };
  section: { id: string; name: string };
  subject: { id: string; name: string };
  questions: TeacherQuizQuestion[];
}

export interface QuizQuestionInput {
  questionText: string;
  questionType: QuizQuestionType;
  marks: number;
  orderIndex: number;
  options?: { id: string; text: string }[];
  correctAnswer?: string | boolean;
}

export interface CreateQuizRequest {
  classId: string;
  sectionId: string;
  subjectId: string;
  title: string;
  description?: string;
  totalMarks: number;
  durationMinutes: number;
}

export interface QuizAttemptRow {
  id: string;
  status: AttemptStatus;
  gradingStatus: AttemptGradingStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  resultPublishedAt: string | null;
  autoScore: number | null;
  finalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  needsReviewCount: number;
  student: { id: string; fullName: string; rollNumber: string | null; admissionNumber: string | null };
}

export interface QuizAttemptsResponse extends Paginated<QuizAttemptRow> {
  quiz: { id: string; title: string; status: QuizStatus; totalMarks: DecimalLike };
}

export interface QuizAttemptsQuery {
  status?: AttemptStatus;
  gradingStatus?: AttemptGradingStatus;
  studentSearch?: string;
  page?: number;
  limit?: number;
}

export interface QuizReviewAnswer {
  answerId: string;
  questionId: string;
  questionNumber: number;
  questionText: string;
  questionType: QuizQuestionType;
  maxMarks: number;
  options: { id: string; label?: string; text?: string }[];
  configurationError: string | null;
  submittedAnswer: unknown;
  expectedAnswer: unknown;
  isCorrect: boolean | null;
  autoAwardedMarks: number | null;
  teacherAwardedMarks: number | null;
  finalAwardedMarks: number | null;
  teacherFeedback: string | null;
  gradingStatus: AttemptGradingStatus;
  needsManualReview: boolean;
}

export interface QuizAttemptReview {
  quiz: { id: string; title: string; totalMarks: number; status: QuizStatus };
  student: { id: string; fullName: string; rollNumber: string | null; admissionNumber: string | null; class?: NamedRef; section?: NamedRef };
  attempt: {
    id: string;
    status: AttemptStatus;
    gradingStatus: AttemptGradingStatus;
    submittedAt: string | null;
    gradedAt: string | null;
    resultPublishedAt: string | null;
    autoScore: number | null;
    finalScore: number | null;
    maxScore: number | null;
    percentage: number | null;
    overallFeedback: string | null;
    needsReviewCount: number;
  };
  answers: QuizReviewAnswer[];
}

export interface GradeQuizAttemptRequest {
  answers: { answerId: string; awardedMarks: number; feedback?: string }[];
  overallFeedback?: string;
  finalize?: boolean;
}
