import type {
  CohortSummary,
  ScoreAggregate,
  SectionPerformance,
  SectionStudentRow,
  StudentPerformance,
  TeacherOverview,
} from '@/api/contracts/performance';

export const score = (overrides: Partial<ScoreAggregate> = {}): ScoreAggregate => ({ scoredItems: 0, totalScore: 0, totalMax: 0, weightedPercentage: null, meanOfPercentages: null, ...overrides });

const notes = { scoredEvidence: 'x', percentages: 'y', periodBasis: 'z', truncatedAssessments: false, truncatedStudents: false };

/** A student with no records at all: every percentage is null. */
export function emptyPerformance(overrides: Partial<StudentPerformance> = {}): StudentPerformance {
  return {
    student: { studentProfileId: 's1', name: 'Asha Rao', rollNumber: '12', class: { id: 'c1', name: 'Class 8' }, section: { id: 'sec1', name: 'A' }, academicYear: { id: 'y1', name: '2026-27' } },
    period: { from: '2026-04-01T00:00:00.000Z', to: '2027-03-31T00:00:00.000Z' },
    scope: { subjectId: null, assignedSubjectsOnly: false },
    quizzes: { ...score(), assigned: 0, submitted: 0, pendingReview: 0, released: 0, releasedWithoutScore: 0, submissionRate: null },
    homework: { ...score(), assigned: 0, submitted: 0, late: 0, pendingReview: 0, graded: 0, gradedWithoutScore: 0, dueOrSubmitted: 0, overdueNotSubmitted: 0, completionRate: null },
    attendance: { totalSessions: 0, present: 0, absent: 0, percentage: null, status: 'no_data', monthly: [] },
    overall: score(),
    subjects: [],
    trend: { direction: 'insufficient_data', earlierPercentage: null, recentPercentage: null, deltaPoints: null, scoredItems: 0, monthly: [] },
    insights: [],
    suggestions: [],
    topics: { status: 'unavailable', reason: 'not mapped' },
    practice: { status: 'unavailable', reason: 'no data' },
    dataNotes: { ...notes },
    generatedBy: 'rules',
    aiGenerated: false,
    ...overrides,
  };
}

/** A student with released quiz scores, graded homework and flagged insights. */
export function richPerformance(overrides: Partial<StudentPerformance> = {}): StudentPerformance {
  return emptyPerformance({
    quizzes: { ...score({ scoredItems: 2, totalScore: 14, totalMax: 20, weightedPercentage: 70, meanOfPercentages: 70 }), assigned: 4, submitted: 3, pendingReview: 1, released: 2, releasedWithoutScore: 0, submissionRate: 75 },
    homework: { ...score({ scoredItems: 1, totalScore: 9, totalMax: 10, weightedPercentage: 90, meanOfPercentages: 90 }), assigned: 3, submitted: 2, late: 1, pendingReview: 1, graded: 1, gradedWithoutScore: 0, dueOrSubmitted: 3, overdueNotSubmitted: 1, completionRate: 66.67 },
    attendance: { totalSessions: 20, present: 18, absent: 2, percentage: 90, status: 'ok', monthly: [{ month: '2026-06', present: 9, absent: 1, percentage: 90 }] },
    overall: score({ scoredItems: 3, totalScore: 23, totalMax: 30, weightedPercentage: 76.67, meanOfPercentages: 80 }),
    subjects: [
      { subjectId: 'math', subjectName: 'Mathematics', quiz: score(), homework: score(), combined: score({ scoredItems: 3, totalScore: 12, totalMax: 30, weightedPercentage: 40, meanOfPercentages: 40 }), status: 'ok' },
      { subjectId: 'sci', subjectName: 'Science', quiz: score(), homework: score(), combined: score({ scoredItems: 1, totalScore: 9, totalMax: 10, weightedPercentage: 90, meanOfPercentages: 90 }), status: 'limited' },
    ],
    insights: [
      { code: 'LOW_SUBJECT_SCORE', status: 'flagged', severity: 'attention', subjectId: 'math', subjectName: 'Mathematics', message: 'Mathematics: released scores average 40% across 3 graded items.', evidence: { scoredItems: 3, weightedPercentage: 40, thresholdPercent: 50 } },
      { code: 'LOW_ATTENDANCE', status: 'insufficient_data', severity: 'info', message: 'Only 3 attendance session(s) recorded; at least 10 are needed before flagging.', evidence: { sessions: 3, percentage: 33.33 } },
      { code: 'OVERDUE_HOMEWORK', status: 'flagged', severity: 'attention', message: '1 homework item(s) are past due without a submission.', evidence: { overdueCount: 1, items: [{ homeworkId: 'h1', title: 'Fractions worksheet', subjectName: 'Mathematics', dueDate: '2026-06-10T00:00:00.000Z' }] } },
    ],
    suggestions: [{ code: 'LOW_SUBJECT_SCORE', text: 'Review recent graded work in this subject with the teacher and revise the questions that lost marks.', basedOn: 'LOW_SUBJECT_SCORE' }],
    ...overrides,
  });
}

export const cohort = (overrides: Partial<CohortSummary> = {}): CohortSummary => ({
  studentCount: 30,
  quizzes: { assigned: 4, expectedSubmissions: 120, submitted: 90, submissionRate: 75, pendingReview: 6, scored: score({ scoredItems: 80, totalScore: 600, totalMax: 800, weightedPercentage: 75 }) },
  homework: { assigned: 5, dueOrSubmittedTotal: 120, submitted: 100, completionRate: 83.33, late: 7, pendingReview: 9, overdueNotSubmitted: 20, scored: score() },
  attendance: { totalSessions: 300, present: 270, absent: 30, percentage: 90 },
  overall: score({ scoredItems: 80, totalScore: 600, totalMax: 800, weightedPercentage: 75 }),
  subjects: [{ subjectId: 'math', subjectName: 'Mathematics', quiz: score(), homework: score(), combined: score({ scoredItems: 40, totalScore: 200, totalMax: 400, weightedPercentage: 50 }), studentsWithScores: 28 }],
  followUpCount: 4,
  ...overrides,
});

export function overview(overrides: Partial<TeacherOverview> = {}): TeacherOverview {
  return {
    academicYear: { id: 'y1', name: '2026-27' },
    period: { from: '2026-04-01T00:00:00.000Z', to: '2027-03-31T00:00:00.000Z' },
    totals: { sections: 2, students: 55, pendingQuizReviews: 6, pendingHomeworkReviews: 9, studentsNeedingFollowUp: 4 },
    sections: [
      { class: { id: 'c1', name: 'Class 8' }, section: { id: 'sec1', name: 'A' }, subjectCount: 2, summary: cohort() },
      { class: { id: 'c1', name: 'Class 8' }, section: { id: 'sec2', name: 'B' }, subjectCount: 1, summary: cohort({ studentCount: 25, followUpCount: 0 }) },
    ],
    topics: { status: 'unavailable' },
    dataNotes: { ...notes },
    generatedBy: 'rules',
    ...overrides,
  };
}

export const studentRow = (id: string, overrides: Partial<SectionStudentRow> = {}): SectionStudentRow => ({
  studentProfileId: id,
  name: `Student ${id}`,
  rollNumber: id.replace(/\D/g, '') || null,
  overallPercentage: null,
  scoredItems: 0,
  homeworkCompletionRate: null,
  overdueHomework: 0,
  pendingReviews: 0,
  attendancePercentage: null,
  followUp: { required: false, reasons: [] },
  ...overrides,
});

export function sectionPage(items: SectionStudentRow[], meta: { page: number; totalPages: number; total: number }, overrides: Partial<SectionPerformance> = {}): SectionPerformance {
  return {
    class: { id: 'c1', name: 'Class 8' },
    section: { id: 'sec1', name: 'A' },
    period: { from: '2026-04-01T00:00:00.000Z', to: '2027-03-31T00:00:00.000Z' },
    scope: { subjects: [{ id: 'math', name: 'Mathematics' }, { id: 'sci', name: 'Science' }], assignedSubjectsOnly: true },
    summary: cohort(),
    followUp: { count: 2, students: { items, meta: { page: meta.page, limit: 25, total: meta.total, totalPages: meta.totalPages } } },
    topics: { status: 'unavailable' },
    dataNotes: { ...notes },
    generatedBy: 'rules',
    ...overrides,
  };
}
