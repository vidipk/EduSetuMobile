import { apiClient } from '@/api/client';
import { AppApiError } from '@/api/client/error';
import type {
  ParentAttendanceQuery,
  ParentAttendanceResponse,
  ParentHomeworkItem,
  ParentNotice,
  ParentNoticesQuery,
  ParentQuizResultItem,
} from '@/api/contracts/parent';
import type { Paginated } from '@/api/contracts/teacher-ops';
import { validateRange } from '@/features/performance/period';

import { cleanParams } from './teacher-ops';

const id = encodeURIComponent;

/** Read-only parent endpoints. Every call is scoped by the backend to the parent's linked children. */
export const parentApi = {
  async attendance(studentProfileId: string, query: ParentAttendanceQuery = {}) {
    const rangeError = validateRange(query.from, query.to);
    if (rangeError) throw new AppApiError(rangeError, 400, 'INVALID_PERIOD');
    return (await apiClient.get<ParentAttendanceResponse>(`/parents/me/children/${id(studentProfileId)}/attendance`, { params: cleanParams({ ...query }) })).data;
  },
  async homework(studentProfileId: string, query: { page?: number; limit?: number } = {}) {
    return (await apiClient.get<Paginated<ParentHomeworkItem>>(`/parents/me/children/${id(studentProfileId)}/homework`, { params: cleanParams({ ...query }) })).data;
  },
  async quizResults(studentProfileId: string, query: { page?: number; limit?: number } = {}) {
    const response = await apiClient.get<Paginated<ParentQuizResultItem>>(`/parents/me/children/${id(studentProfileId)}/quizzes`, { params: cleanParams({ ...query }) });
    // List rows are keyed by attempt; expose a stable `id` for paging/merging.
    return { ...response.data, items: response.data.items.map((item) => ({ ...item, id: item.attemptId })) };
  },
  async notices(query: ParentNoticesQuery = {}) {
    return (await apiClient.get<Paginated<ParentNotice>>('/parents/me/notices', { params: cleanParams({ ...query }) })).data;
  },
  async notice(noticeId: string) {
    return (await apiClient.get<ParentNotice>(`/parents/me/notices/${id(noticeId)}`)).data;
  },
};
