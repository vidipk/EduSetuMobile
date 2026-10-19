import { apiClient } from '@/api/client';
import type {
  ActiveRevisionResponse,
  ChapterDoubtRequest,
  ChapterDoubtResponse,
  ChapterOption,
  ConversationDetail,
  ConversationList,
  FlashcardsResponse,
  GenerationScope,
  PracticeQuestionType,
  PracticeQuestionsResponse,
  RevisionChaptersResponse,
  RevisionConfig,
  RevisionReply,
  RevisionStudyPhase,
  StudentDashboardForAi,
  TextRevisionSession,
  VoiceSessionDetail,
  VoiceSessionEnd,
  VoiceSessionStart,
} from '@/api/contracts/ai-learning';
import type { Paginated } from '@/api/contracts/teacher-ops';

import { cleanParams } from './teacher-ops';

const id = encodeURIComponent;
type Signal = { signal?: AbortSignal };

/** Student AI endpoints. All requests go through the authenticated backend; no AI provider keys exist on the device. */
export const studentAiApi = {
  async dashboard() {
    return (await apiClient.get<StudentDashboardForAi>('/students/me/dashboard')).data;
  },
  /** Chapters are the published courses of a subject that the student can access. */
  async chapters(subjectId: string) {
    const response = await apiClient.get<Paginated<{ id: string; title: string; description?: string | null; subjectId: string }>>('/courses', { params: cleanParams({ subjectId, limit: 100 }) });
    return response.data.items.map((course): ChapterOption => ({ id: course.id, title: course.title, description: course.description ?? null, subjectId: course.subjectId }));
  },
  async askChapterDoubt(body: ChapterDoubtRequest, options: Signal = {}) {
    return (await apiClient.post<ChapterDoubtResponse>('/ai/student/chapter-doubt/ask', body, { signal: options.signal })).data;
  },
  async listConversations(query: { module?: string; subjectId?: string; page?: number; limit?: number }) {
    return (await apiClient.get<ConversationList>('/ai/student/conversations', { params: cleanParams({ ...query }) })).data;
  },
  async conversation(conversationId: string) {
    return (await apiClient.get<ConversationDetail>(`/ai/student/conversations/${id(conversationId)}`)).data;
  },

  async revisionConfig() {
    return (await apiClient.get<RevisionConfig>('/ai/student/revision/config')).data;
  },
  async revisionChapters(subjectId: string, studyPhase: RevisionStudyPhase) {
    return (await apiClient.get<RevisionChaptersResponse>('/ai/student/revision/chapters', { params: { subjectId, studyPhase } })).data;
  },
  async activeRevision() {
    return (await apiClient.get<ActiveRevisionResponse>('/ai/student/revision/sessions/active')).data;
  },
  async startTextRevision(body: { subjectId: string; studyPhase: RevisionStudyPhase; chapterIds: string[]; language?: string }, options: Signal = {}) {
    return (await apiClient.post<TextRevisionSession>('/ai/student/revision/sessions', { ...body, mode: 'TEXT' }, { signal: options.signal })).data;
  },
  async sendRevisionMessage(sessionId: string, message: string, options: Signal = {}) {
    return (await apiClient.post<RevisionReply>(`/ai/student/revision/sessions/${id(sessionId)}/message`, { message }, { signal: options.signal })).data;
  },
  async endTextRevision(sessionId: string) {
    return (await apiClient.post<{ sessionId: string; status?: string; summary?: string }>(`/ai/student/revision/sessions/${id(sessionId)}/end`, {})).data;
  },

  async generateFlashcards(scope: GenerationScope & { numberOfCards: number }, options: Signal = {}) {
    return (await apiClient.post<FlashcardsResponse>('/ai/student/flashcards/generate', scope, { signal: options.signal })).data;
  },
  async generatePractice(scope: GenerationScope & { questionType: PracticeQuestionType; numberOfQuestions: number }, options: Signal = {}) {
    return (await apiClient.post<PracticeQuestionsResponse>('/ai/student/practice-questions/generate', scope, { signal: options.signal })).data;
  },

  // Realtime voice: the backend validates access and quota, creates the LiveKit room, a short-lived
  // participant token and dispatches the agent. The token is held in memory only.
  async startDoubtVoice(body: { subjectId: string; chapterId: string; partId?: string; clientRequestId?: string }) {
    return (await apiClient.post<VoiceSessionStart>('/ai/voice/session/create', { experienceType: 'CHAPTER_DOUBT_VOICE', ...body })).data;
  },
  async startRevisionVoice(body: { subjectId: string; studyPhase: RevisionStudyPhase; chapterIds: string[]; language?: string }) {
    return (await apiClient.post<VoiceSessionStart>('/ai/student/revision/sessions', { ...body, mode: 'VOICE' })).data;
  },
  async resumeVoice(sessionId: string) {
    return (await apiClient.post<VoiceSessionStart>(`/ai/sessions/${id(sessionId)}/resume`)).data;
  },
  async voiceSession(sessionId: string) {
    return (await apiClient.get<VoiceSessionDetail>(`/ai/sessions/${id(sessionId)}`)).data;
  },
  async endVoice(sessionId: string, summary?: string) {
    return (await apiClient.post<VoiceSessionEnd>(`/ai/sessions/${id(sessionId)}/end`, { reason: 'USER_ENDED', ...(summary ? { summary } : {}) })).data;
  },
};
