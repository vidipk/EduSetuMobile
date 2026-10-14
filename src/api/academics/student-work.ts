import { apiClient } from '@/api/client';
import type {
  StudentHomeworkDetail,
  StudentHomeworkSummary,
  QuizAttemptResult,
  StartQuizAttemptResponse,
  SubmitHomeworkRequest,
  SubmitQuizAttemptRequest,
  StudentQuizDetail,
  StudentQuizSummary,
} from '@/api/contracts/student-work';

export const studentWorkApi = {
  async listQuizzes() {
    const response = await apiClient.get<StudentQuizSummary[]>('/students/me/quizzes');
    return response.data;
  },
  async getQuiz(id: string) {
    const response = await apiClient.get<StudentQuizDetail>(`/quizzes/${id}`);
    return response.data;
  },
  async startQuiz(id: string) {
    const response = await apiClient.post<StartQuizAttemptResponse>(`/quizzes/${id}/start`);
    return response.data;
  },
  async submitQuizAttempt(attemptId: string, payload: SubmitQuizAttemptRequest) {
    const response = await apiClient.post<QuizAttemptResult>(`/quiz-attempts/${attemptId}/submit`, payload);
    return response.data;
  },
  async getQuizAttemptResult(attemptId: string) {
    const response = await apiClient.get<QuizAttemptResult>(`/quiz-attempts/${attemptId}/result`);
    return response.data;
  },
  async listHomework() {
    const response = await apiClient.get<StudentHomeworkSummary[]>('/students/me/homework');
    return response.data;
  },
  async getHomework(id: string) {
    const response = await apiClient.get<StudentHomeworkDetail>(`/students/me/homework/${id}`);
    return response.data;
  },
  async submitHomework(id: string, payload: SubmitHomeworkRequest) {
    const form = new FormData();
    if (payload.submissionText) form.append('submissionText', payload.submissionText);
    if (payload.fileUrl) form.append('fileUrl', payload.fileUrl);
    if (payload.submissionMethod) form.append('submissionMethod', payload.submissionMethod);
    if (payload.driveUrl) form.append('driveUrl', payload.driveUrl);
    form.append('objectiveAnswers', JSON.stringify(payload.objectiveAnswers ?? []));
    if (payload.file) form.append('file', payload.file as unknown as Blob);
    const response = await apiClient.post<StudentHomeworkDetail['submission']>(
      `/students/me/homework/${id}/submission`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
