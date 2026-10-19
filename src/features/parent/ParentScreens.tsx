import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { parentApi } from '@/api/academics/parent';
import { performanceApi } from '@/api/academics/performance';
import type { ParentHomeworkItem, ParentNotice } from '@/api/contracts/parent';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppText, EmptyState } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { Chips, ErrorPanel, Notice, Row, Section, Tile } from '@/features/performance/components';
import { marksText, percentText, percentValue } from '@/features/performance/format';
import { PERIOD_PRESETS, presetRange, type PeriodPreset } from '@/features/performance/period';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { useLoadMore } from '@/features/teacher-ops/hooks';
import { displayDate, displayDateTime, trimNumber } from '@/features/teacher-ops/logic';
import { BackButton, ButtonRow, FormScroll, Heading, SkeletonList, StatusBadge } from '@/features/teacher-ops/ui';
import { useParentChildren } from './hooks';

function ChildSwitcher({ model }: { model: ReturnType<typeof useParentChildren> }) {
  if (model.children.length < 2) return null;
  return <Chips label="Child" options={model.children.map((child) => ({ id: child.studentProfileId, label: child.name }))} value={model.selected?.studentProfileId ?? ''} onChange={model.select} />;
}

function ChildHeader({ model }: { model: ReturnType<typeof useParentChildren> }) {
  const child = model.selected;
  if (!child) return null;
  return (
    <AppCard accessible accessibilityLabel={`Showing ${child.name}`} style={styles.cardGap}>
      <AppText style={styles.title}>{child.name}</AppText>
      <AppText style={styles.muted}>{child.class.name} {child.section.name} · {child.academicYear.name}{child.rollNumber ? ` · Roll ${child.rollNumber}` : ''}</AppText>
    </AppCard>
  );
}

function ChildGate({ model }: { model: ReturnType<typeof useParentChildren> }) {
  return (
    <>
      {model.loading ? <SkeletonList rows={1} /> : null}
      {model.error ? <ErrorPanel error={model.error} onRetry={model.reload} /> : null}
      {model.data && model.children.length === 0 ? <EmptyState title="No linked children" detail="Ask your school to link your child to your account." /> : null}
    </>
  );
}

// ---------------------------------------------------------------- dashboard

export function ParentDashboardScreen() {
  const { user } = useAuth();
  const model = useParentChildren();
  const child = model.selected;
  const uid = user?.id;
  const perf = useRemoteData(uid && child ? `parent-dash-perf:${uid}:${child.studentProfileId}` : null, () => performanceApi.getChildPerformance((child as NonNullable<typeof child>).studentProfileId));
  const notices = useRemoteData(uid && child ? `parent-dash-notices:${uid}:${child.studentProfileId}` : null, () => parentApi.notices({ studentProfileId: (child as NonNullable<typeof child>).studentProfileId, limit: 3 }));
  const data = perf.data && child && perf.data.student.studentProfileId === child.studentProfileId ? perf.data : null;
  const go = (pathname: '/child-attendance' | '/child-homework' | '/child-quizzes') => router.push(pathname);

  return (
    <FormScroll testID="parent-dashboard" refreshing={model.refreshing || perf.refreshing} onRefresh={() => { void model.refresh(); void perf.refresh(); void notices.refresh(); }}>
      <Heading title="Parent dashboard" subtitle={user ? "Your child's school progress at a glance." : undefined} />
      <ChildGate model={model} />
      <ChildSwitcher model={model} />
      <ChildHeader model={model} />
      {child ? (
        <>
          {perf.loading ? <SkeletonList rows={1} /> : null}
          {perf.error ? <ErrorPanel error={perf.error.notFound || perf.error.forbidden ? { ...perf.error, message: 'This child is no longer available on your account.' } : perf.error} onRetry={perf.reload} /> : null}
          {data ? (
            <>
              {data.dataNotes.truncatedAssessments ? <Notice tone="warning">Incomplete data: only the most recent quizzes and homework are included.</Notice> : null}
              <View style={styles.tiles}>
                <Tile label="Attendance" value={percentValue(data.attendance.percentage)} detail={data.attendance.totalSessions ? `${data.attendance.present} of ${data.attendance.totalSessions} days present` : null} />
                <Tile label="Homework completion" value={percentValue(data.homework.completionRate)} detail={`${data.homework.submitted} submitted · ${data.homework.overdueNotSubmitted} overdue`} />
                <Tile label="Quizzes taken" value={`${data.quizzes.submitted}/${data.quizzes.assigned}`} detail={data.quizzes.pendingReview ? `${data.quizzes.pendingReview} awaiting results` : 'No results pending'} />
                <Tile label="Overall score" value={percentValue(data.overall.weightedPercentage)} detail={marksText(data.overall)} />
              </View>
              <AppText style={styles.hint}>Scores include only released quiz results and graded homework.</AppText>
            </>
          ) : null}
          <Section title="Explore">
            <ButtonRow>
              <AppButton title="Attendance" onPress={() => go('/child-attendance')} />
              <AppButton title="Homework" onPress={() => go('/child-homework')} />
              <AppButton title="Quizzes" onPress={() => go('/child-quizzes')} />
              <AppButton title="Detailed progress" onPress={() => router.push('/(parent)/(tabs)/child')} />
            </ButtonRow>
          </Section>
          <Section title="Latest notices">
            {notices.loading ? <SkeletonList rows={1} /> : null}
            {notices.error ? <ErrorPanel error={notices.error} onRetry={notices.reload} /> : null}
            {notices.data && notices.data.items.length === 0 ? <AppText style={styles.muted}>No notices for {child.name} yet.</AppText> : null}
            {notices.data?.items.map((notice) => <NoticeCard key={notice.id} notice={notice} showChildren={false} />)}
            <AppButton title="All notices" onPress={() => router.push('/(parent)/(tabs)/notices')} />
          </Section>
        </>
      ) : null}
    </FormScroll>
  );
}

// ---------------------------------------------------------------- attendance

export function ParentAttendanceScreen() {
  const { user } = useAuth();
  const model = useParentChildren();
  const child = model.selected;
  const [preset, setPreset] = useState<PeriodPreset>('academic-year');
  const key = user && child ? `parent-attendance:${user.id}:${child.studentProfileId}:${preset}` : null;
  const query = (page: number) => ({ ...presetRange(preset), page, limit: 31 });
  const first = useRemoteData(key, () => parentApi.attendance((child as NonNullable<typeof child>).studentProfileId, query(1)));
  const list = useLoadMore(first.data, (page) => parentApi.attendance((child as NonNullable<typeof child>).studentProfileId, query(page)));
  const summary = first.data && child && first.data.child.studentProfileId === child.studentProfileId ? first.data.summary : null;

  return (
    <FormScroll refreshing={first.refreshing} onRefresh={() => void first.refresh()}>
      <BackButton />
      <Heading title="Attendance" subtitle="Official, submitted attendance only." />
      <ChildGate model={model} />
      <ChildSwitcher model={model} />
      <ChildHeader model={model} />
      {child ? <Chips label="Period" options={PERIOD_PRESETS} value={preset} onChange={setPreset} /> : null}
      {first.error ? <ErrorPanel error={first.error} onRetry={first.reload} /> : null}
      {first.loading ? <SkeletonList /> : null}
      {summary ? (
        summary.total === 0 ? <EmptyState title="No attendance recorded" detail="No submitted attendance exists for this period." /> : (
          <>
            <View style={styles.tiles}>
              <Tile label="Attendance" value={`${trimNumber(summary.attendancePercentage)}%`} detail={`${summary.present} present · ${summary.absent} absent of ${summary.total}`} />
            </View>
            <Section title="Daily record">
              <AppText style={styles.muted}>Showing {list.items.length} of {list.total} days</AppText>
              {list.items.map((record) => (
                <AppCard key={record.id} style={styles.row}>
                  <View style={styles.flex}>
                    <AppText style={styles.rowTitle}>{displayDate(record.date)}</AppText>
                    {record.subject ? <AppText style={styles.muted}>{record.subject.name}</AppText> : null}
                    {record.remarks ? <AppText style={styles.muted}>{record.remarks}</AppText> : null}
                  </View>
                  <StatusBadge status={record.status} label={record.status === 'PRESENT' ? 'Present' : 'Absent'} />
                </AppCard>
              ))}
              {list.error ? <ErrorPanel error={list.error} onRetry={() => void list.loadMore()} /> : null}
              {list.hasMore ? <AppButton title="Load more days" loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
            </Section>
          </>
        )
      ) : null}
    </FormScroll>
  );
}

// ------------------------------------------------------------------ homework

const HOMEWORK_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'TODO', label: 'To do' },
  { id: 'SUBMITTED', label: 'Submitted' },
  { id: 'REVIEWED', label: 'Reviewed' },
] as const;

function homeworkBucket(item: ParentHomeworkItem): 'TODO' | 'SUBMITTED' | 'REVIEWED' {
  if (item.submissionStatus === 'GRADED' || item.submissionStatus === 'RETURNED') return 'REVIEWED';
  if (item.submissionStatus === 'SUBMITTED' || item.submissionStatus === 'LATE') return 'SUBMITTED';
  return 'TODO';
}

export function ParentHomeworkScreen() {
  const { user } = useAuth();
  const model = useParentChildren();
  const child = model.selected;
  const [filter, setFilter] = useState<(typeof HOMEWORK_FILTERS)[number]['id']>('ALL');
  const key = user && child ? `parent-homework:${user.id}:${child.studentProfileId}` : null;
  const first = useRemoteData(key, () => parentApi.homework((child as NonNullable<typeof child>).studentProfileId, { page: 1, limit: 20 }));
  const list = useLoadMore(first.data, (page) => parentApi.homework((child as NonNullable<typeof child>).studentProfileId, { page, limit: 20 }));
  const shown = list.items.filter((item) => filter === 'ALL' || homeworkBucket(item) === filter);

  return (
    <FormScroll refreshing={first.refreshing} onRefresh={() => void first.refresh()}>
      <BackButton />
      <Heading title="Homework" subtitle="Read-only view of assigned homework." />
      <ChildGate model={model} />
      <ChildSwitcher model={model} />
      <ChildHeader model={model} />
      {child ? <Chips label="Filter" options={HOMEWORK_FILTERS.map((entry) => ({ id: entry.id, label: entry.label }))} value={filter} onChange={setFilter} /> : null}
      {first.error ? <ErrorPanel error={first.error} onRetry={first.reload} /> : null}
      {first.loading ? <SkeletonList /> : null}
      {first.data ? <AppText style={styles.muted}>Showing {shown.length} of {list.total} homework</AppText> : null}
      {first.data && shown.length === 0 ? <EmptyState title="No homework" detail={filter === 'ALL' ? 'No homework has been assigned yet.' : 'Nothing matches this filter.'} /> : null}
      {shown.map((item) => <HomeworkCard key={item.id} item={item} />)}
      {list.error ? <ErrorPanel error={list.error} onRetry={() => void list.loadMore()} /> : null}
      {list.hasMore ? <AppButton title="Load more homework" loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
    </FormScroll>
  );
}

function HomeworkCard({ item }: { item: ParentHomeworkItem }) {
  const bucket = homeworkBucket(item);
  const [now] = useState(() => Date.now());
  const overdue = bucket === 'TODO' && new Date(item.dueDate).getTime() < now;
  const label = bucket === 'REVIEWED' ? 'Reviewed' : item.submissionStatus === 'LATE' ? 'Submitted late' : bucket === 'SUBMITTED' ? 'Submitted · awaiting review' : overdue ? 'Not submitted · overdue' : 'Not submitted';
  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.rowBetween}>
        <AppText style={styles.rowTitle}>{item.title}</AppText>
        <StatusBadge status={bucket === 'REVIEWED' ? 'GRADED' : bucket === 'SUBMITTED' ? 'SUBMITTED' : 'NOT_SUBMITTED'} label={label} />
      </View>
      <AppText style={styles.muted}>{item.subject.name} · Due {displayDate(item.dueDate)}</AppText>
      {item.submission?.submittedAt ? <AppText style={styles.muted}>Submitted {displayDateTime(item.submission.submittedAt)}</AppText> : null}
      {bucket === 'REVIEWED' && item.submission?.marks !== null && item.submission?.marks !== undefined ? <AppText style={styles.rowTitle}>Marks: {trimNumber(item.submission.marks)}{item.totalMarks !== null ? ` / ${trimNumber(item.totalMarks)}` : ''}</AppText> : null}
      {bucket === 'REVIEWED' && item.submission?.feedback ? <AppText accessibilityLabel="Teacher feedback" style={styles.feedback}>Teacher feedback: {item.submission.feedback}</AppText> : null}
    </AppCard>
  );
}

// ------------------------------------------------------------------- quizzes

export function ParentQuizzesScreen() {
  const { user } = useAuth();
  const model = useParentChildren();
  const child = model.selected;
  const uid = user?.id;
  const key = uid && child ? `parent-quizzes:${uid}:${child.studentProfileId}` : null;
  const first = useRemoteData(key, () => parentApi.quizResults((child as NonNullable<typeof child>).studentProfileId, { page: 1, limit: 20 }));
  const list = useLoadMore(first.data, (page) => parentApi.quizResults((child as NonNullable<typeof child>).studentProfileId, { page, limit: 20 }));
  const perf = useRemoteData(uid && child ? `parent-quizzes-perf:${uid}:${child.studentProfileId}` : null, () => performanceApi.getChildPerformance((child as NonNullable<typeof child>).studentProfileId));
  const stats = perf.data && child && perf.data.student.studentProfileId === child.studentProfileId ? perf.data : null;
  const subjects = stats?.subjects.filter((subject) => subject.quiz.scoredItems > 0) ?? [];

  return (
    <FormScroll refreshing={first.refreshing} onRefresh={() => { void first.refresh(); void perf.refresh(); }}>
      <BackButton />
      <Heading title="Quizzes" subtitle="Published results only. Answer keys are never shown." />
      <ChildGate model={model} />
      <ChildSwitcher model={model} />
      <ChildHeader model={model} />
      {stats ? (
        <View style={styles.tiles}>
          <Tile label="Assigned" value={String(stats.quizzes.assigned)} />
          <Tile label="Taken" value={String(stats.quizzes.submitted)} />
          <Tile label="Awaiting results" value={String(stats.quizzes.pendingReview)} detail="Not counted as zero" />
          <Tile label="Average" value={percentValue(stats.quizzes.weightedPercentage)} detail={marksText(stats.quizzes)} />
        </View>
      ) : null}
      {subjects.length ? (
        <Section title="By subject">
          {subjects.map((subject) => (
            <AppCard key={subject.subjectId} style={styles.row}>
              <AppText style={styles.rowTitle}>{subject.subjectName}</AppText>
              <AppText style={styles.rowTitle}>{percentText(subject.quiz.weightedPercentage)}</AppText>
            </AppCard>
          ))}
        </Section>
      ) : null}
      <Section title="Published results">
        {first.loading ? <SkeletonList /> : null}
        {first.error ? <ErrorPanel error={first.error} onRetry={first.reload} /> : null}
        {first.data && list.items.length === 0 ? <EmptyState title="No published results" detail="Results appear here after the teacher publishes them." /> : null}
        {list.items.map((result) => (
          <AppCard key={result.attemptId} style={styles.cardGap}>
            <View style={styles.rowBetween}>
              <AppText style={styles.rowTitle}>{result.quiz.title}</AppText>
              <StatusBadge status="EVALUATED" label="Result published" />
            </View>
            <AppText style={styles.muted}>{result.quiz.subject.name} · {displayDate(result.submittedAt)}</AppText>
            {result.score !== null && result.maxScore !== null ? <AppText style={styles.rowTitle}>Score {trimNumber(result.score)} / {trimNumber(result.maxScore)}{result.percentage !== null ? ` (${trimNumber(result.percentage)}%)` : ''}</AppText> : null}
          </AppCard>
        ))}
        {list.error ? <ErrorPanel error={list.error} onRetry={() => void list.loadMore()} /> : null}
        {list.hasMore ? <AppButton title="Load more results" loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
      </Section>
    </FormScroll>
  );
}

// ------------------------------------------------------------------- notices

function NoticeCard({ notice, showChildren }: { notice: ParentNotice; showChildren: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Notice: ${notice.title}`} onPress={() => router.push({ pathname: '/parent-notice/[noticeId]', params: { noticeId: notice.id } })}>
      <AppCard style={styles.cardGap}>
        <View style={styles.rowBetween}>
          <AppText style={styles.rowTitle}>{notice.title}</AppText>
          <AppText style={styles.tag}>{notice.type.replace(/_/g, ' ').toLowerCase()}</AppText>
        </View>
        <AppText numberOfLines={2} style={styles.muted}>{notice.body}</AppText>
        <AppText style={styles.hint}>{displayDate(notice.publishedAt ?? notice.createdAt)}{showChildren && notice.forChildren.length ? ` · For ${notice.forChildren.map((entry) => entry.name).join(', ')}` : ''}</AppText>
      </AppCard>
    </Pressable>
  );
}

export function ParentNoticesScreen() {
  const { user } = useAuth();
  const model = useParentChildren();
  const [scope, setScope] = useState('all');
  const key = user && model.data ? `parent-notices:${user.id}:${scope}` : null;
  const query = (page: number) => ({ page, limit: 15, studentProfileId: scope === 'all' ? undefined : scope });
  const first = useRemoteData(key, () => parentApi.notices(query(1)));
  const list = useLoadMore(first.data, (page) => parentApi.notices(query(page)));

  return (
    <FormScroll refreshing={first.refreshing} onRefresh={() => { void first.refresh(); void model.refresh(); }}>
      <Heading title="Notices" subtitle="Published notices addressed to your children." />
      {model.error ? <ErrorPanel error={model.error} onRetry={model.reload} /> : null}
      {model.children.length > 1 ? <Chips label="Notices for" options={[{ id: 'all', label: 'All children' }, ...model.children.map((child) => ({ id: child.studentProfileId, label: child.name }))]} value={scope} onChange={setScope} /> : null}
      {first.loading ? <SkeletonList /> : null}
      {first.error ? <ErrorPanel error={first.error} onRetry={first.reload} /> : null}
      {first.data && list.items.length === 0 ? <EmptyState title="No notices" detail="There are no published notices for your children yet." /> : null}
      {list.items.map((notice) => <NoticeCard key={notice.id} notice={notice} showChildren={model.children.length > 1} />)}
      {list.error ? <ErrorPanel error={list.error} onRetry={() => void list.loadMore()} /> : null}
      {list.hasMore ? <AppButton title="Load more notices" loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
    </FormScroll>
  );
}

export function ParentNoticeDetailScreen() {
  const params = useLocalSearchParams<{ noticeId: string }>();
  const noticeId = Array.isArray(params.noticeId) ? params.noticeId[0] : params.noticeId;
  const detail = useRemoteData(noticeId ? `parent-notice:${noticeId}` : null, () => parentApi.notice(noticeId));
  const notice = detail.data;
  return (
    <FormScroll refreshing={detail.refreshing} onRefresh={() => void detail.refresh()}>
      <BackButton />
      {detail.loading ? <SkeletonList rows={1} /> : null}
      {detail.error ? <ErrorPanel error={detail.error.notFound || detail.error.forbidden ? { ...detail.error, message: 'This notice is not available to you.' } : detail.error} onRetry={detail.reload} /> : null}
      {notice ? (
        <>
          <Heading title={notice.title} subtitle={`${notice.createdBy.fullName} · ${displayDateTime(notice.publishedAt ?? notice.createdAt)}`} />
          <View style={styles.rowBetween}>
            <AppText style={styles.tag}>{notice.type.replace(/_/g, ' ').toLowerCase()}</AppText>
            {notice.status === 'ARCHIVED' ? <StatusBadge status="ARCHIVED" /> : null}
          </View>
          {notice.forChildren.length ? <Row label="For" value={notice.forChildren.map((entry) => entry.name).join(', ')} /> : null}
          <AppCard><AppText style={styles.body}>{notice.body}</AppText></AppCard>
          <AppText style={styles.hint}>Academic year {notice.academicYear.name}</AppText>
        </>
      ) : null}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 12 },
  body: { lineHeight: 24 },
  tag: { backgroundColor: '#E6ECEB', borderRadius: 4, color: colors.text, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 2, textTransform: 'capitalize' },
  cardGap: { gap: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  rowBetween: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  rowTitle: { flexShrink: 1, fontSize: 16, fontWeight: '700' },
  flex: { flex: 1 },
  feedback: { backgroundColor: '#F2F6F5', borderRadius: 8, lineHeight: 22, padding: spacing.md },
});
