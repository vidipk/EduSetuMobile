import { apiClient } from '@/api/client';
import { env } from '@/config/env';
import type {
  AttendanceRoster,
  AttendanceScopeQuery,
  AttendanceSessionDetail,
  AttendanceSessionSummary,
  AttendanceSessionsQuery,
  AttendanceStatus,
  CreateQuizRequest,
  GradeQuizAttemptRequest,
  HomeworkDetail,
  HomeworkListItem,
  HomeworkListQuery,
  HomeworkSubmissionDetail,
  HomeworkSubmissionRecord,
  Paginated,
  QuizAttemptReview,
  QuizAttemptsQuery,
  QuizAttemptsResponse,
  QuizDetail,
  QuizListItem,
  QuizQuestionInput,
  SaveHomeworkRequest,
  TeacherProfile,
  TeacherQuizQuestion,
} from '@/api/contracts/teacher-ops';

type Params = Record<string, string | number | boolean>;

/** Drops empty values; page sizes are capped at the backend maximum. */
export function cleanParams(input: Record<string, string | number | boolean | undefined | null>): Params {
  const params: Params = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    params[key] = key === 'limit' && typeof value === 'number' ? Math.min(value, 100) : value;
  }
  return params;
}

const id = encodeURIComponent;

export const teacherProfileApi = {
  async get() {
    return (await apiClient.get<TeacherProfile>('/teachers/me/profile')).data;
  },
};

export const attendanceApi = {
  async getRoster(query: AttendanceScopeQuery) {
    return (await apiClient.get<AttendanceRoster>('/attendance/roster', { params: cleanParams({ ...query }) })).data;
  },
  /** Idempotent on the backend: returns the existing session for the same class/section/date. */
  async createSession(query: AttendanceScopeQuery) {
    return (await apiClient.post<AttendanceSessionSummary>('/attendance/sessions', cleanParams({ ...query }))).data;
  },
  /** Saves the full roster snapshot as the official draft. */
  async saveRecords(sessionId: string, records: { studentId: string; status: AttendanceStatus }[]) {
    await apiClient.post(`/attendance/sessions/${id(sessionId)}/records`, { records });
  },
  async submit(sessionId: string) {
    return (await apiClient.patch<AttendanceSessionSummary>(`/attendance/sessions/${id(sessionId)}/submit`)).data;
  },
  async list(query: AttendanceSessionsQuery) {
    return (await apiClient.get<Paginated<AttendanceSessionSummary>>('/attendance/sessions', { params: cleanParams({ ...query }) })).data;
  },
  async get(sessionId: string) {
    return (await apiClient.get<AttendanceSessionDetail>(`/attendance/sessions/${id(sessionId)}`)).data;
  },
};

export const homeworkApi = {
  async list(query: HomeworkListQuery) {
    return (await apiClient.get<Paginated<HomeworkListItem>>('/homework', { params: cleanParams({ ...query }) })).data;
  },
  async get(homeworkId: string) {
    return (await apiClient.get<HomeworkDetail>(`/homework/${id(homeworkId)}`)).data;
  },
  async create(body: SaveHomeworkRequest) {
    return (await apiClient.post<HomeworkListItem>('/homework', body)).data;
  },
  async update(homeworkId: string, body: SaveHomeworkRequest) {
    return (await apiClient.patch<HomeworkListItem>(`/homework/${id(homeworkId)}`, body)).data;
  },
  async publish(homeworkId: string) {
    return (await apiClient.patch<HomeworkListItem>(`/homework/${id(homeworkId)}/publish`)).data;
  },
  async remove(homeworkId: string) {
    await apiClient.delete(`/homework/${id(homeworkId)}`);
  },
  async submissions(homeworkId: string) {
    return (await apiClient.get<HomeworkSubmissionRecord[]>(`/homework/${id(homeworkId)}/submissions`)).data;
  },
  async submissionDetail(submissionId: string) {
    return (await apiClient.get<HomeworkSubmissionDetail>(`/homework/submissions/${id(submissionId)}`)).data;
  },
  /** Authenticated endpoint; the access token is sent as a header, never in the URL. */
  submissionFileUrl(submissionId: string) {
    return `${env.EXPO_PUBLIC_API_BASE_URL}/homework/submissions/${id(submissionId)}/file`;
  },
  async grade(submissionId: string, body: { marks: number; feedback?: string }) {
    return (await apiClient.patch<HomeworkSubmissionRecord>(`/homework/submissions/${id(submissionId)}/grade`, body)).data;
  },
};

export const quizApi = {
  async list(query: { classId?: string; sectionId?: string; subjectId?: string; status?: string; page?: number; limit?: number }) {
    return (await apiClient.get<Paginated<QuizListItem>>('/quizzes', { params: cleanParams({ ...query }) })).data;
  },
  async get(quizId: string) {
    return (await apiClient.get<QuizDetail>(`/quizzes/${id(quizId)}`)).data;
  },
  async create(body: CreateQuizRequest) {
    return (await apiClient.post<QuizDetail>('/quizzes', body)).data;
  },
  async update(quizId: string, body: Partial<CreateQuizRequest>) {
    return (await apiClient.patch<QuizDetail>(`/quizzes/${id(quizId)}`, body)).data;
  },
  async remove(quizId: string) {
    await apiClient.delete(`/quizzes/${id(quizId)}`);
  },
  async publish(quizId: string) {
    return (await apiClient.patch<QuizDetail>(`/quizzes/${id(quizId)}/publish`)).data;
  },
  async addQuestion(quizId: string, body: QuizQuestionInput) {
    return (await apiClient.post<TeacherQuizQuestion>(`/quizzes/${id(quizId)}/questions`, body)).data;
  },
  async updateQuestion(questionId: string, body: Partial<QuizQuestionInput>) {
    return (await apiClient.patch<TeacherQuizQuestion>(`/quiz-questions/${id(questionId)}`, body)).data;
  },
  async removeQuestion(questionId: string) {
    await apiClient.delete(`/quiz-questions/${id(questionId)}`);
  },
  async attempts(quizId: string, query: QuizAttemptsQuery) {
    return (await apiClient.get<QuizAttemptsResponse>(`/quizzes/${id(quizId)}/attempts`, { params: cleanParams({ ...query }) })).data;
  },
  async review(attemptId: string) {
    return (await apiClient.get<QuizAttemptReview>(`/quiz-attempts/${id(attemptId)}/review`)).data;
  },
  async grade(attemptId: string, body: GradeQuizAttemptRequest) {
    return (await apiClient.patch<QuizAttemptReview>(`/quiz-attempts/${id(attemptId)}/grade`, body)).data;
  },
};
