// Mirrors backend src/modules/performance (Phase A4.1). Percentages are `null`
// when there is no scored evidence; they are never 0 in that case.

export type DataStatus = 'ok' | 'limited' | 'no_data';
export type InsightCode = 'LOW_SUBJECT_SCORE' | 'DECLINING_PERFORMANCE' | 'OVERDUE_HOMEWORK' | 'LOW_ATTENDANCE';

export interface ScoreAggregate {
  scoredItems: number;
  totalScore: number;
  totalMax: number;
  weightedPercentage: number | null;
  meanOfPercentages: number | null;
}

export interface QuizMetrics extends ScoreAggregate {
  assigned: number;
  submitted: number;
  pendingReview: number;
  released: number;
  releasedWithoutScore: number;
  submissionRate: number | null;
}

export interface HomeworkMetrics extends ScoreAggregate {
  assigned: number;
  submitted: number;
  late: number;
  pendingReview: number;
  graded: number;
  gradedWithoutScore: number;
  dueOrSubmitted: number;
  overdueNotSubmitted: number;
  completionRate: number | null;
}

export interface AttendanceMonth {
  month: string;
  present: number;
  absent: number;
  percentage: number | null;
}

export interface AttendanceMetrics {
  totalSessions: number;
  present: number;
  absent: number;
  percentage: number | null;
  status: 'ok' | 'no_data';
  rule?: string;
  monthly?: AttendanceMonth[];
}

export interface SubjectMetrics {
  subjectId: string;
  subjectName: string;
  quiz: ScoreAggregate;
  homework: ScoreAggregate;
  combined: ScoreAggregate;
  status: DataStatus;
}

export interface TrendPoint {
  month: string;
  weightedPercentage: number;
  scoredItems: number;
}

export interface TrendMetrics {
  direction: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  earlierPercentage: number | null;
  recentPercentage: number | null;
  deltaPoints: number | null;
  scoredItems: number;
  monthly: TrendPoint[];
}

export interface OverdueHomeworkEvidence {
  homeworkId: string;
  title: string;
  subjectName: string;
  dueDate: string;
}

export type InsightEvidenceValue = number | string | null | OverdueHomeworkEvidence[];

export interface Insight {
  code: InsightCode;
  status: 'flagged' | 'insufficient_data';
  severity: 'info' | 'attention';
  subjectId?: string;
  subjectName?: string | null;
  message: string;
  evidence: Record<string, InsightEvidenceValue>;
}

export interface Suggestion {
  code: InsightCode;
  text: string;
  basedOn: InsightCode;
}

export interface CapabilityStatus {
  status: string;
  reason?: string;
}

export interface PerformanceDataNotes {
  scoredEvidence: string;
  percentages: string;
  periodBasis: string;
  truncatedAssessments: boolean;
  truncatedStudents: boolean;
}

export interface PerformancePeriod {
  from: string;
  to: string;
  basis?: string;
}

export interface PerformanceStudent {
  studentProfileId: string;
  name: string;
  rollNumber: string | null;
  class: { id: string; name: string };
  section: { id: string; name: string };
  academicYear: { id: string; name: string };
}

export interface StudentPerformance {
  student: PerformanceStudent;
  period: PerformancePeriod;
  scope: { subjectId: string | null; assignedSubjectsOnly: boolean };
  quizzes: QuizMetrics;
  homework: HomeworkMetrics;
  attendance: AttendanceMetrics;
  overall: ScoreAggregate;
  subjects: SubjectMetrics[];
  trend: TrendMetrics;
  insights: Insight[];
  suggestions: Suggestion[];
  topics: CapabilityStatus;
  practice: CapabilityStatus;
  dataNotes: PerformanceDataNotes;
  generatedBy: 'rules';
  aiGenerated: false;
}

export interface CohortSubject {
  subjectId: string;
  subjectName: string;
  quiz: ScoreAggregate;
  homework: ScoreAggregate;
  combined: ScoreAggregate;
  studentsWithScores: number;
}

export interface CohortSummary {
  studentCount: number;
  quizzes: {
    assigned: number;
    expectedSubmissions: number;
    submitted: number;
    submissionRate: number | null;
    pendingReview: number;
    scored: ScoreAggregate;
  };
  homework: {
    assigned: number;
    dueOrSubmittedTotal: number;
    submitted: number;
    completionRate: number | null;
    late: number;
    pendingReview: number;
    overdueNotSubmitted: number;
    scored: ScoreAggregate;
  };
  attendance: { totalSessions: number; present: number; absent: number; percentage: number | null };
  overall: ScoreAggregate;
  subjects: CohortSubject[];
  followUpCount: number;
}

export interface TeacherOverview {
  academicYear: { id: string; name: string };
  period: PerformancePeriod;
  totals: {
    sections: number;
    students: number;
    pendingQuizReviews: number;
    pendingHomeworkReviews: number;
    studentsNeedingFollowUp: number;
  };
  sections: {
    class: { id: string; name: string };
    section: { id: string; name: string };
    subjectCount: number;
    summary: CohortSummary;
  }[];
  topics: CapabilityStatus;
  dataNotes: PerformanceDataNotes;
  generatedBy: 'rules';
}

export interface FollowUpReason {
  code: InsightCode;
  status: 'flagged' | 'insufficient_data';
  subjectName: string | null;
  message: string;
  evidence: Record<string, InsightEvidenceValue>;
}

export interface SectionStudentRow {
  studentProfileId: string;
  name: string;
  rollNumber: string | null;
  overallPercentage: number | null;
  scoredItems: number;
  homeworkCompletionRate: number | null;
  overdueHomework: number;
  pendingReviews: number;
  attendancePercentage: number | null;
  followUp: { required: boolean; reasons: FollowUpReason[] };
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SectionPerformance {
  class: { id: string; name: string };
  section: { id: string; name: string };
  period: PerformancePeriod;
  scope: { subjects: { id: string; name: string }[]; assignedSubjectsOnly: boolean };
  summary: CohortSummary;
  followUp: { count: number; students: { items: SectionStudentRow[]; meta: PaginatedMeta } };
  topics: CapabilityStatus;
  dataNotes: PerformanceDataNotes;
  generatedBy: 'rules';
}

export interface PerformanceQuery {
  from?: string;
  to?: string;
  subjectId?: string;
}

export interface TeacherPerformanceQuery extends PerformanceQuery {
  academicYearId?: string;
}

export interface SectionPerformanceQuery extends TeacherPerformanceQuery {
  page?: number;
  limit?: number;
  followUpOnly?: boolean;
}

export interface ParentChild {
  studentProfileId: string;
  name: string;
  avatarUrl: string | null;
  studentCode: string;
  admissionNumber: string;
  rollNumber: string | null;
  relation: string;
  isPrimary: boolean;
  class: { id: string; name: string };
  section: { id: string; name: string };
  academicYear: { id: string; name: string };
}

export interface TeacherClassCard {
  assignmentId: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  displayName: string;
  subjects: { subjectId: string; subjectName: string }[];
  studentCount: number;
  academicYear: { id: string; name: string; isActive: boolean };
}
