import { apiClient } from '@/api/client';
import { AppApiError } from '@/api/client/error';
import type {
  ParentChild,
  PerformanceQuery,
  SectionPerformance,
  SectionPerformanceQuery,
  StudentPerformance,
  TeacherClassCard,
  TeacherOverview,
  TeacherPerformanceQuery,
} from '@/api/contracts/performance';
import { validateRange } from '@/features/performance/period';

type Params = Record<string, string | number | boolean>;

/** Drops empty values and rejects invalid ranges before any request is made. */
export function buildPerformanceParams(query: SectionPerformanceQuery = {}): Params {
  const rangeError = validateRange(query.from, query.to);
  if (rangeError) throw new AppApiError(rangeError, 400, 'INVALID_PERIOD');
  const params: Params = {};
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.subjectId) params.subjectId = query.subjectId;
  if (query.academicYearId) params.academicYearId = query.academicYearId;
  if (query.page) params.page = query.page;
  if (query.limit) params.limit = Math.min(query.limit, 100);
  if (query.followUpOnly) params.followUpOnly = true;
  return params;
}

const id = encodeURIComponent;

export const performanceApi = {
  async getMyPerformance(query?: PerformanceQuery) {
    const response = await apiClient.get<StudentPerformance>('/students/me/performance', { params: buildPerformanceParams(query) });
    return response.data;
  },
  async getChildPerformance(studentProfileId: string, query?: PerformanceQuery) {
    const response = await apiClient.get<StudentPerformance>(`/parents/me/children/${id(studentProfileId)}/performance`, { params: buildPerformanceParams(query) });
    return response.data;
  },
  async getTeacherOverview(query?: TeacherPerformanceQuery) {
    const response = await apiClient.get<TeacherOverview>('/teachers/me/performance/overview', { params: buildPerformanceParams(query) });
    return response.data;
  },
  async getSectionPerformance(classId: string, sectionId: string, query?: SectionPerformanceQuery) {
    const response = await apiClient.get<SectionPerformance>(`/teachers/me/classes/${id(classId)}/sections/${id(sectionId)}/performance`, { params: buildPerformanceParams(query) });
    return response.data;
  },
  async getTeacherStudentPerformance(studentProfileId: string, query?: PerformanceQuery) {
    const response = await apiClient.get<StudentPerformance>(`/teachers/me/students/${id(studentProfileId)}/performance`, { params: buildPerformanceParams(query) });
    return response.data;
  },
  async listChildren() {
    const response = await apiClient.get<ParentChild[]>('/parents/me/children');
    return response.data;
  },
  async listTeacherClasses() {
    const response = await apiClient.get<TeacherClassCard[]>('/teachers/me/classes');
    return response.data;
  },
};
