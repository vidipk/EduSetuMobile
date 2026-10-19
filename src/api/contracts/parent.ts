// Parent-facing, read-only contracts (backend: /parents/me/...). Parents never mutate academic records.

import type { Paginated } from './teacher-ops';

export interface ParentAttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT';
  remarks: string | null;
  subject: { id: string; name: string } | null;
}

export interface ParentAttendanceResponse extends Paginated<ParentAttendanceRecord> {
  child: { studentProfileId: string; name: string; class: { id: string; name: string }; section: { id: string; name: string } };
  /** `attendancePercentage` is 0 when `total` is 0: treat total === 0 as "no attendance recorded". */
  summary: { total: number; present: number; absent: number; attendancePercentage: number };
}

export interface ParentAttendanceQuery {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export type ParentSubmissionStatus = 'NOT_SUBMITTED' | 'DRAFT' | 'SUBMITTED' | 'LATE' | 'GRADED' | 'RETURNED';

export interface ParentHomeworkItem {
  id: string;
  title: string;
  dueDate: string;
  publishedAt: string | null;
  status: string;
  homeworkType: 'OBJECTIVE' | 'SUBJECTIVE' | 'MIXED';
  totalMarks: number | null;
  subject: { id: string; name: string };
  submissionStatus: ParentSubmissionStatus;
  submission: { id: string; submittedAt: string | null; gradedAt: string | null; marks: number | null; feedback: string | null } | null;
}

export interface ParentQuizResultItem {
  attemptId: string;
  status: string;
  gradingStatus: string;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  submittedAt: string | null;
  gradedAt: string | null;
  resultPublishedAt: string | null;
  quiz: { id: string; title: string; subject: { id: string; name: string } };
}

export type ParentNoticeType = string;

export interface ParentNotice {
  id: string;
  academicYearId: string;
  type: ParentNoticeType;
  status: 'PUBLISHED' | 'ARCHIVED';
  title: string;
  body: string;
  relatedResourceType: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string; role: string };
  academicYear: { id: string; name: string };
  /** The linked children this notice is addressed to. */
  forChildren: { studentProfileId: string; name: string }[];
}

export interface ParentNoticesQuery {
  studentProfileId?: string;
  type?: string;
  page?: number;
  limit?: number;
}
