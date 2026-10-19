// Student AI Learning contracts. Mirrors the backend /ai/* and /students/me/dashboard responses.

import type { Paginated } from './teacher-ops';

export interface StudentSubject {
  id: string;
  name: string;
  code?: string | null;
}

export interface AiFeatureAvailability {
  studentAiEnabled: boolean;
  /** Per-feature school switches; absent on older backends, which are treated as enabled. */
  textDoubtEnabled?: boolean;
  flashcardsEnabled?: boolean;
  practiceQuestionsEnabled?: boolean;
  voiceAiEnabled: boolean;
  voiceDoubtAssistantEnabled: boolean;
  voiceAvailable: boolean;
  voiceDisabledReason: string | null;
  remainingVoiceMinutes: number;
  monthlyVoiceMinutesLimit: number;
}

export interface StudentDashboardForAi {
  profile: { id: string; fullName: string; class: { id: string; name: string }; section: { id: string; name: string }; academicYear: { id: string; name: string } };
  subjects: StudentSubject[];
  featureAvailability: AiFeatureAvailability;
}

export interface ChapterOption {
  id: string;
  title: string;
  description?: string | null;
  subjectId: string;
}

export interface SourceReference {
  sourceId: string;
  title: string;
  type: string;
  partId: string | null;
}

export interface ChapterDoubtRequest {
  conversationId?: string;
  subjectId: string;
  chapterId: string;
  partId?: string;
  question: string;
  language?: string;
}

export interface ChapterDoubtResponse {
  conversationId: string;
  answer: string;
  example: string;
  followUpQuestions: string[];
  practiceSuggestion: string;
  /** True only when the answer used retrieved school material. */
  grounded: boolean;
  sourceReferences: SourceReference[];
  academicContext: { subjectName: string; chapterId: string; chapterName: string; partId: string | null; partName: string | null };
}

export interface ConversationSummary {
  id: string;
  module: string;
  title: string | null;
  subjectId: string | null;
  chapter: string | null;
  topic: string | null;
  status: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  sender: 'USER' | 'AI';
  content: Record<string, unknown>;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
}

export type ConversationList = Paginated<ConversationSummary>;

// ---------------------------------------------------------------- revision

export type RevisionStudyPhase = 'UNIT_I' | 'TERM_I' | 'UNIT_II' | 'TERM_II' | 'PRELIMS' | 'FINAL';

export interface RevisionCapability {
  available: boolean;
  disabledReason: string | null;
  remainingMinutes?: number;
}

export interface RevisionConfig {
  studentClass: { id: string; name: string };
  studentSection: { id: string; name: string };
  subjects: StudentSubject[];
  availableStudyPhases: { value: RevisionStudyPhase; label: string }[];
  capabilities: { text: RevisionCapability; voice: RevisionCapability };
}

export interface RevisionChaptersResponse {
  subjectId: string;
  studyPhase: RevisionStudyPhase;
  source: 'CONFIGURED' | 'DERIVED_DEFAULT';
  chapters: { id: string; name: string; order?: number | null; selectedByDefault: boolean }[];
  emptyReason?: string | null;
}

export interface RevisionChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

export interface TextRevisionSession {
  sessionId: string;
  conversationId?: string;
  mode: 'TEXT';
  subjectId: string;
  subjectName?: string;
  studyPhase: RevisionStudyPhase;
  studyPhaseLabel?: string;
  overview?: string;
  chapters: { id: string; name: string; order?: number | null }[];
  messages?: RevisionChatMessage[];
  keyPoints?: string[];
  checkQuestions?: (string | Record<string, unknown>)[];
}

export interface RevisionReply {
  sessionId: string;
  reply?: string;
  followUpQuestions?: string[];
}

export interface ActiveRevisionResponse {
  active: boolean;
  session: null | {
    sessionId: string;
    mode: 'TEXT' | 'VOICE' | 'AVATAR';
    aiSessionId: string | null;
    conversationId: string | null;
    subjectId: string;
    subjectName: string;
    studyPhase: RevisionStudyPhase;
    studyPhaseLabel: string;
    startedAt: string;
    chapters: { id: string; name: string; order?: number | null }[];
    messages: RevisionChatMessage[];
  };
}

// ---------------------------------------------------- practice and flashcards

export type PracticeQuestionType = 'mcq' | 'short_answer' | 'numerical' | 'mixed';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GenerationScope {
  classId: string;
  sectionId: string;
  subjectId: string;
  chapter: string;
  topic: string;
  difficulty: Difficulty;
  language?: string;
}

export interface Flashcard {
  front: string;
  back: string;
  hint: string;
  difficulty: string;
}

export interface FlashcardsResponse {
  conversationId: string;
  title: string;
  flashcards: Flashcard[];
}

export interface PracticeQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
}

export interface PracticeQuestionsResponse {
  conversationId: string;
  title: string;
  questions: PracticeQuestion[];
}

// -------------------------------------------------------------------- voice

export type RealtimeAgentState = string | null;

export interface VoiceSessionStart {
  sessionId: string;
  /** Present for revision voice sessions. */
  revisionSessionId?: string;
  status: string;
  roomName: string;
  participantToken: string;
  livekitUrl: string;
  expiresAt: string;
  maxSessionSeconds: number;
  remainingMonthlySeconds: number;
  initialGreeting?: string | null;
  resumed?: boolean;
  academicContext?: { subjectId?: string | null; subjectName?: string | null; chapterId?: string | null; chapterName?: string | null };
}

export interface VoiceTranscriptMessage {
  id: string;
  role: 'STUDENT' | 'ASSISTANT' | 'SYSTEM' | string;
  transcriptText: string | null;
  sequenceNumber: number | null;
}

export interface VoiceSessionDetail {
  sessionId: string;
  status: string;
  experienceType: string;
  initialGreeting: string | null;
  summary: string | null;
  runtimeState: { agentState: RealtimeAgentState; userState: RealtimeAgentState; lastProviderError: string | null };
  messages: VoiceTranscriptMessage[];
}

export interface VoiceSessionEnd {
  sessionId: string;
  status: string;
  summary?: string | null;
}
