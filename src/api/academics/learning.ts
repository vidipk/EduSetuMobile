import { apiClient } from '@/api/client';
import type {
  CatalogCourse,
  ChangePasswordRequest,
  CourseLessonRecord,
  NotificationRecord,
  LearningAnalytics,
  LearningCourse,
  LearningExperience,
  LearningHome,
  LearningLessonDetail,
  LearningTask,
  LearningTranscript,
  OpenVideoResult,
  Paginated,
  StudentNotice,
  VideoCatalogue,
  VideoCatalogueQuery,
} from '@/api/contracts/learning';

const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== null));

export const learningApi = {
  async experience() {
    return (await apiClient.get<LearningExperience>('/learning/me/experience')).data;
  },
  async home() {
    return (await apiClient.get<LearningHome>('/learning/me/home')).data;
  },
  async analytics() {
    return (await apiClient.get<LearningAnalytics>('/learning/me/analytics')).data;
  },
  async tasks() {
    return (await apiClient.get<LearningTask[]>('/learning/me/tasks')).data;
  },
  async catalogue(query: VideoCatalogueQuery = {}) {
    return (await apiClient.get<VideoCatalogue>('/learning/videos', { params: clean(query) })).data;
  },
  async openVideo(videoId: string) {
    return (await apiClient.post<OpenVideoResult>(`/learning/videos/${encodeURIComponent(videoId)}/open`)).data;
  },
  async transcript(videoId: string, language?: string) {
    return (await apiClient.get<LearningTranscript>(`/learning/videos/${encodeURIComponent(videoId)}/transcript`, { params: clean({ language }) })).data;
  },
  async courses() {
    return (await apiClient.get<LearningCourse[]>('/learning/courses')).data;
  },
  async lesson(courseId: string, lessonId: string) {
    return (await apiClient.get<LearningLessonDetail>(`/learning/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`)).data;
  },
  async setReduceAnimations(reduceAnimations: boolean) {
    return (await apiClient.patch<{ reduceAnimations: boolean }>('/learning/me/preferences', { reduceAnimations })).data;
  },
  async notices(page = 1, limit = 15) {
    return (await apiClient.get<Paginated<StudentNotice>>('/notices/me', { params: { page, limit } })).data;
  },
  /** Published courses the student may see, each with its subject (existing GET /courses; students cannot call /subjects). */
  async catalogCourses() {
    return (await apiClient.get<Paginated<CatalogCourse>>('/courses', { params: { limit: 100 } })).data.items;
  },
  async courseLessons(courseId: string) {
    return (await apiClient.get<CourseLessonRecord[]>(`/courses/${encodeURIComponent(courseId)}/lessons`)).data;
  },
  async notifications(page = 1, limit = 20, isRead?: boolean) {
    return (await apiClient.get<Paginated<NotificationRecord>>('/notifications', { params: clean({ page, limit, isRead }) })).data;
  },
  async unreadCount() {
    return (await apiClient.get<{ count: number }>('/notifications/unread-count')).data.count;
  },
  async markNotificationRead(id: string) {
    await apiClient.patch(`/notifications/${encodeURIComponent(id)}/read`);
  },
  async markAllNotificationsRead() {
    await apiClient.patch('/notifications/read-all');
  },
  async changePassword(payload: ChangePasswordRequest) {
    await apiClient.post('/auth/change-password', payload);
  },
};
