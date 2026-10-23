export type MascotState =
  | 'WELCOME'
  | 'NEW_LESSON'
  | 'DAILY_TASK_AVAILABLE'
  | 'SUCCESSFUL_COMPLETION'
  | 'STREAK_MILESTONE'
  | 'GENTLE_REMINDER';

export interface LearningExperienceConfig {
  mascot: { enabled: boolean; name: string | null; assetKey: string | null; messages: Partial<Record<MascotState, string>> };
  languages: string[];
  streakMilestones: number[];
}

export type LearningExperience =
  | { enabled: false }
  | { enabled: true; experienceKey: string; config: LearningExperienceConfig };

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface LearningTopic {
  id: string;
  name: string;
}

export interface LearningVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  watchUrl: string;
  youtubeVideoId: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  language: string | null;
  topic: LearningTopic | null;
}

export interface VideoCatalogue extends Paginated<LearningVideo> {
  topics: LearningTopic[];
}

export interface VideoCatalogueQuery {
  page?: number;
  limit?: number;
  search?: string;
  topicId?: string;
  language?: string;
}

export interface OpenVideoResult {
  watchUrl: string;
  recorded: boolean;
  /** Opening a link is never proof of watching. */
  verifiedWatch: false;
}

export type TaskState = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';

export interface LearningTask {
  assignmentId: string;
  quizId: string;
  title: string;
  durationMinutes: number;
  assignedDate: string;
  dueAt: string;
  state: TaskState;
  overdue: boolean;
  attemptId: string | null;
  submittedAt: string | null;
  result: { score: string | number | null; maxScore: string | number | null; percentage: string | number | null } | null;
}

export interface TopicStat {
  topicId: string;
  name: string;
  attempts: number;
  averagePercentage: number;
  strength: boolean;
  needsRevision: boolean;
}

export interface LearningHome {
  learner: { fullName: string; organizationName: string | null; className: string | null };
  streak: { current: number; longest: number; lastActivityDate: string | null; today: string };
  quizStatistics: { completed: number; resultsReleased: number; averagePercentage: number | null };
  pendingToday: LearningTask[];
  recentActivity: { attemptId: string; quizId: string; title: string; submittedAt: string | null; percentage: string | number | null; resultReleased: boolean }[];
  continueLearning: { id: string; title: string; thumbnailUrl: string | null; watchUrl: string; openedAt?: string } | null;
  recommendedRevision: TopicStat[];
  mascot: { enabled: boolean; state: MascotState; message: string | null; reduceAnimations: boolean };
}

export interface LearningAnalytics {
  tasks: { assigned: number; completed: number; pending: number; overdue: number };
  quizzes: LearningHome['quizStatistics'];
  trend: { title: string; percentage: number; submittedAt: string | null }[];
  topics: TopicStat[];
  streak: { current: number; longest: number; lastActivityDate: string | null };
  courseProgress: { courseId: string; title: string; lessonsOpened: number; lessonCount: number }[];
  history: { type: string; occurredAt: string; date: string; verified: boolean; title: string | null }[];
}

export interface LearningCourseLesson {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  opened: boolean;
}

export interface LearningCourse {
  id: string;
  title: string;
  description: string | null;
  lessonsOpened: number;
  lessons: LearningCourseLesson[];
}

export interface LearningLessonDetail {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  content: {
    summary?: string;
    keyConcepts?: string[];
    glossary?: { term: string; meaning: string }[];
    importantTeachings?: string[];
    reflectionPrompts?: string[];
  } | null;
  videos: { id: string; title: string; thumbnailUrl: string | null; watchUrl: string }[];
}

export interface StudentNotice {
  id: string;
  type: string;
  status: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string; role: string };
  academicYear: { id: string; name: string };
  delivery: { notificationId: string; isRead: boolean; readAt: string | null; deliveredAt: string };
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** A published course (chapter) with its subject, from the student-authorised GET /courses. */
export interface CatalogCourse {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  subject: { id: string; name: string; code: string | null; description: string | null } | null;
  _count?: { lessons: number; videos: number; sourceLibraryItems: number };
}

export interface CourseLessonRecord {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  status?: string;
}

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: 'SYSTEM' | 'ACADEMIC' | 'BILLING' | 'REMINDER' | 'ALERT' | 'NOTICE';
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  noticeId: string | null;
  notice: { id: string; type: string; status: string; title: string; publishedAt: string | null } | null;
}
