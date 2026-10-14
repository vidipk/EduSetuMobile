import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { performanceApi } from '@/api/academics/performance';
import type { CohortSummary, SectionPerformance, SectionStudentRow } from '@/api/contracts/performance';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppScreen, AppText, EmptyState } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';

import { Chips, ErrorPanel, LoadingPanel, Notice, PerformanceScroll, PeriodChips, ProgressBar, Row, Section, StudentPerformanceView, Tile, TruncationNotice } from './components';
import { NOT_ENOUGH_DATA, describeError, marksText, percentText, percentValue, type ErrorPresentation } from './format';
import { presetRange, type PeriodPreset } from './period';
import { useRemoteData } from './use-remote-data';
import { ALL_SUBJECTS, useSubjectOptions } from './use-subject-options';

const PAGE_SIZE = 25;
const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

// ---------------------------------------------------------------- overview

export function TeacherOverviewScreen() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<PeriodPreset>('academic-year');
  const { data, error, loading, refreshing, reload, refresh } = useRemoteData(user ? `overview:${user.id}:${preset}` : null, () =>
    performanceApi.getTeacherOverview(presetRange(preset)),
  );

  return (
    <AppScreen style={{ padding: 0 }}>
      <PerformanceScroll refreshing={refreshing} onRefresh={() => void refresh()}>
        <AppText style={styles.title}>Class performance</AppText>
        <PeriodChips value={preset} onChange={setPreset} />
        {error ? <ErrorPanel error={error} onRetry={reload} /> : null}
        {loading ? <LoadingPanel /> : null}
        {data ? (
          <>
            <AppText style={styles.muted}>{data.academicYear.name}</AppText>
            <TruncationNotice notes={data.dataNotes} />
            <View style={styles.tiles}>
              <Tile label="Sections" value={String(data.totals.sections)} detail={`${data.totals.students} students`} />
              <Tile label="Need follow-up" value={String(data.totals.studentsNeedingFollowUp)} detail="Based on recorded evidence" />
              <Tile label="Quizzes to review" value={String(data.totals.pendingQuizReviews)} />
              <Tile label="Homework to review" value={String(data.totals.pendingHomeworkReviews)} />
            </View>
            {data.sections.length === 0 ? <EmptyState title="No assigned sections" detail="You have no class assignments in this academic year." /> : null}
            {data.sections.map((entry) => (
              <Pressable
                key={`${entry.class.id}:${entry.section.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${entry.class.name} ${entry.section.name} performance`}
                onPress={() => router.push({ pathname: '/section/[classId]/[sectionId]', params: { classId: entry.class.id, sectionId: entry.section.id } })}
              >
                <AppCard style={styles.cardGap}>
                  <AppText style={styles.cardTitle}>{entry.class.name} {entry.section.name}</AppText>
                  <AppText style={styles.muted}>{entry.summary.studentCount} students · {entry.subjectCount} {entry.subjectCount === 1 ? 'subject' : 'subjects'} taught</AppText>
                  <SummaryRows summary={entry.summary} />
                </AppCard>
              </Pressable>
            ))}
          </>
        ) : null}
      </PerformanceScroll>
    </AppScreen>
  );
}

function SummaryRows({ summary }: { summary: CohortSummary }) {
  return (
    <>
      <Row label="Average score" value={percentText(summary.overall.weightedPercentage)} />
      <Row label="Quiz submission rate" value={percentText(summary.quizzes.submissionRate)} />
      <Row label="Homework completion" value={percentText(summary.homework.completionRate)} />
      <Row label="Awaiting review" value={`${summary.quizzes.pendingReview + summary.homework.pendingReview}`} />
      <Row label="Students needing follow-up" value={String(summary.followUpCount)} />
    </>
  );
}

// ----------------------------------------------------------------- section

export function TeacherSectionScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ classId: string; sectionId: string }>();
  const classId = param(params.classId);
  const sectionId = param(params.sectionId);
  const [preset, setPreset] = useState<PeriodPreset>('academic-year');
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const classes = useRemoteData(user ? `classes:${user.id}` : null, () => performanceApi.listTeacherClasses());
  const cards = (classes.data ?? []).filter((card) => card.classId === classId && card.sectionId === sectionId);
  const card = cards.find((entry) => entry.academicYear.isActive) ?? cards[0];
  const subjectOptions = card && card.subjects.length > 1
    ? [{ id: ALL_SUBJECTS, label: 'All my subjects' }, ...card.subjects.map((entry) => ({ id: entry.subjectId, label: entry.subjectName }))]
    : [];

  const key = user && classId && sectionId ? `section:${user.id}:${classId}:${sectionId}:${preset}:${subject}:${followUpOnly}` : null;
  const query = useCallback((page: number) => ({ ...presetRange(preset), subjectId: subject === ALL_SUBJECTS ? undefined : subject, followUpOnly, page, limit: PAGE_SIZE }), [preset, subject, followUpOnly]);
  const first = useRemoteData(key, () => performanceApi.getSectionPerformance(classId, sectionId, query(1)));
  const list = usePagedStudents(first.data, (page) => performanceApi.getSectionPerformance(classId, sectionId, query(page)));

  return (
    <AppScreen style={{ padding: 0 }}>
      <PerformanceScroll refreshing={first.refreshing} onRefresh={() => void first.refresh()}>
        <AppButton title="Back" onPress={() => router.back()} />
        <AppText style={styles.title}>{first.data ? `${first.data.class.name} ${first.data.section.name}` : (card?.displayName ?? 'Section performance')}</AppText>
        <PeriodChips value={preset} onChange={setPreset} />
        {subjectOptions.length ? <Chips label="Subject" options={subjectOptions} value={subject} onChange={setSubject} /> : null}
        <Chips label="Students" options={[{ id: 'all', label: 'All students' }, { id: 'follow-up', label: 'Follow-up only' }]} value={followUpOnly ? 'follow-up' : 'all'} onChange={(id) => setFollowUpOnly(id === 'follow-up')} />
        {first.error ? <ErrorPanel error={sectionError(first.error)} onRetry={first.reload} /> : null}
        {first.loading ? <LoadingPanel /> : null}
        {first.data ? (
          <>
            <AppText style={styles.muted}>Showing subjects you teach: {first.data.scope.subjects.map((entry) => entry.name).join(', ') || 'none'}</AppText>
            <TruncationNotice notes={first.data.dataNotes} />
            <SectionSummary data={first.data} />
            <Section title="Students">
              <AppText style={styles.muted}>Showing {list.items.length} of {first.data.followUp.students.meta.total}{followUpOnly ? ' students needing follow-up' : ' students'}</AppText>
              {list.items.length === 0 ? <EmptyState title={followUpOnly ? 'No students need follow-up' : 'No students found'} detail={followUpOnly ? 'No student has a flagged reason in this period.' : undefined} /> : null}
              {list.items.map((row) => <StudentRow key={row.studentProfileId} row={row} />)}
              {list.error ? <ErrorPanel error={list.error} onRetry={() => void list.loadMore()} /> : null}
              {list.hasMore ? <AppButton title="Load more students" loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
            </Section>
          </>
        ) : null}
      </PerformanceScroll>
    </AppScreen>
  );
}

function sectionError(error: ErrorPresentation): ErrorPresentation {
  return error.forbidden ? { ...error, message: 'You are not assigned to this class and section.' } : error;
}

function SectionSummary({ data }: { data: SectionPerformance }) {
  const { summary } = data;
  return (
    <>
      <View style={styles.tiles}>
        <Tile label="Average score" value={percentValue(summary.overall.weightedPercentage)} detail={marksText(summary.overall)} />
        <Tile label="Quiz submissions" value={percentValue(summary.quizzes.submissionRate)} detail={`${summary.quizzes.submitted} of ${summary.quizzes.expectedSubmissions}`} />
        <Tile label="Homework completion" value={percentValue(summary.homework.completionRate)} detail={`${summary.homework.submitted} of ${summary.homework.dueOrSubmittedTotal} due`} />
        <Tile label="Attendance" value={percentValue(summary.attendance.percentage)} detail={summary.attendance.totalSessions ? `${summary.attendance.totalSessions} records` : null} />
      </View>
      <AppCard style={styles.cardGap}>
        <Row label="Quizzes awaiting results" value={String(summary.quizzes.pendingReview)} />
        <Row label="Homework awaiting grading" value={String(summary.homework.pendingReview)} />
        <Row label="Homework past due, not submitted" value={String(summary.homework.overdueNotSubmitted)} />
        <Row label="Students needing follow-up" value={String(data.followUp.count)} />
      </AppCard>
      <Section title="Subjects">
        {summary.subjects.length === 0 ? <AppText style={styles.muted}>{NOT_ENOUGH_DATA}: no scored work in your subjects yet.</AppText> : summary.subjects.map((entry) => (
          <AppCard key={entry.subjectId} style={styles.cardGap}>
            <Row label={entry.subjectName} value={percentValue(entry.combined.weightedPercentage)} />
            <ProgressBar value={entry.combined.weightedPercentage} />
            <AppText style={styles.muted}>{entry.studentsWithScores} {entry.studentsWithScores === 1 ? 'student' : 'students'} with scored work · {marksText(entry.combined) ?? NOT_ENOUGH_DATA}</AppText>
          </AppCard>
        ))}
      </Section>
    </>
  );
}

function StudentRow({ row }: { row: SectionStudentRow }) {
  const reasons = row.followUp.reasons.filter((reason) => reason.status === 'flagged');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${row.name} performance`} onPress={() => router.push({ pathname: '/student/[studentProfileId]', params: { studentProfileId: row.studentProfileId } })}>
      <AppCard style={styles.cardGap}>
        <View style={styles.rowHead}>
          <AppText style={styles.cardTitle}>{row.name}</AppText>
          {row.followUp.required ? <AppText style={styles.flag}>Follow-up</AppText> : null}
        </View>
        {row.rollNumber ? <AppText style={styles.muted}>Roll {row.rollNumber}</AppText> : null}
        <Row label="Score" value={percentText(row.overallPercentage)} />
        <Row label="Homework completion" value={percentText(row.homeworkCompletionRate)} />
        <Row label="Attendance" value={percentText(row.attendancePercentage)} />
        <Row label="Overdue homework" value={String(row.overdueHomework)} />
        <Row label="Awaiting review" value={String(row.pendingReviews)} />
        {reasons.map((reason) => <AppText key={`${reason.code}-${reason.subjectName ?? ''}`} style={styles.reason}>{reason.message}</AppText>)}
      </AppCard>
    </Pressable>
  );
}

/**
 * Successive pages are appended after page 1, de-duplicated by student id.
 * Extra pages are bound to the exact page-1 response (and so to the filter key)
 * they were requested for: changing a filter or refreshing discards them, and a
 * late page from an old filter can never be merged into a new list.
 */
function usePagedStudents(first: SectionPerformance | null, fetchPage: (page: number) => Promise<SectionPerformance>) {
  type Extra = { first: SectionPerformance; items: SectionStudentRow[]; page: number; loading: boolean; error: ErrorPresentation | null };
  const [extra, setExtra] = useState<Extra | null>(null);
  const firstRef = useRef(first);
  const fetchRef = useRef(fetchPage);
  const busy = useRef<SectionPerformance | null>(null);
  useEffect(() => {
    firstRef.current = first;
    fetchRef.current = fetchPage;
  });

  // Anything bound to an older page-1 response (other filter, or before a refresh) is ignored.
  const valid = extra && first && extra.first === first ? extra : null;
  const baseItems = first?.followUp.students.items ?? [];
  const seen = new Set<string>();
  const items = [...baseItems, ...(valid?.items ?? [])].filter((row) => (seen.has(row.studentProfileId) ? false : (seen.add(row.studentProfileId), true)));
  const page = valid?.page ?? first?.followUp.students.meta.page ?? 1;
  const totalPages = first?.followUp.students.meta.totalPages ?? 1;

  const loadMore = useCallback(async () => {
    const anchor = firstRef.current;
    if (!anchor || busy.current === anchor || page >= totalPages) return;
    busy.current = anchor;
    const requested = page + 1;
    const patch = (change: Partial<Extra>) => setExtra((current) => {
      const base: Extra = current && current.first === anchor ? current : { first: anchor, items: [], page: anchor.followUp.students.meta.page, loading: false, error: null };
      return { ...base, ...change };
    });
    patch({ loading: true, error: null });
    try {
      const response = await fetchRef.current(requested);
      if (firstRef.current !== anchor) return;
      setExtra((current) => {
        const base: Extra = current && current.first === anchor ? current : { first: anchor, items: [], page: anchor.followUp.students.meta.page, loading: false, error: null };
        return { ...base, items: [...base.items, ...response.followUp.students.items], page: requested, loading: false, error: null };
      });
    } catch (loadError) {
      if (firstRef.current === anchor) patch({ loading: false, error: describeError(loadError) });
    } finally {
      if (busy.current === anchor) busy.current = null;
    }
  }, [page, totalPages]);

  return { items, hasMore: page < totalPages, loadingMore: valid?.loading ?? false, error: valid?.error ?? null, loadMore };
}

// ----------------------------------------------------------------- student

export function TeacherStudentScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ studentProfileId: string }>();
  const studentProfileId = param(params.studentProfileId);
  const [preset, setPreset] = useState<PeriodPreset>('academic-year');
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const key = user && studentProfileId ? `tstudent:${user.id}:${studentProfileId}:${preset}:${subject}` : null;
  const { data, error, loading, refreshing, reload, refresh } = useRemoteData(key, () =>
    performanceApi.getTeacherStudentPerformance(studentProfileId, { ...presetRange(preset), subjectId: subject === ALL_SUBJECTS ? undefined : subject }),
  );
  const subjectOptions = useSubjectOptions(user && studentProfileId ? `tstudent:${user.id}:${studentProfileId}` : null, data);
  const shown = data && data.student.studentProfileId === studentProfileId ? data : null;

  return (
    <AppScreen style={{ padding: 0 }}>
      <PerformanceScroll refreshing={refreshing} onRefresh={() => void refresh()}>
        <AppButton title="Back" onPress={() => router.back()} />
        <PeriodChips value={preset} onChange={setPreset} />
        {subjectOptions.length ? <Chips label="Subject" options={subjectOptions} value={subject} onChange={setSubject} /> : null}
        {error ? <ErrorPanel error={error.notFound || error.forbidden ? { ...error, message: 'This student is not available in your current class assignments.' } : error} onRetry={reload} /> : null}
        {loading ? <LoadingPanel /> : null}
        {shown ? <StudentPerformanceView data={shown} /> : null}
        {shown && shown.scope.assignedSubjectsOnly ? <Notice>Results for subjects taught by other teachers are not shown.</Notice> : null}
      </PerformanceScroll>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 20 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cardGap: { gap: spacing.sm },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  rowHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  flag: { backgroundColor: colors.accent, borderRadius: radius.sm, color: '#5B4300', fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 2 },
  reason: { color: colors.text, fontSize: 13, lineHeight: 18 },
});
