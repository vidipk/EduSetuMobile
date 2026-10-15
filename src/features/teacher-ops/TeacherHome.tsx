import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { performanceApi } from '@/api/academics/performance';
import { attendanceApi, homeworkApi, quizApi } from '@/api/academics/teacher-ops';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppText, EmptyState } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';
import { ErrorPanel, Section, Tile } from '@/features/performance/components';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { useTeacherProfile } from './hooks';
import { academicYears, activeAssignments, displayDate, sectionScopes, todayString } from './logic';
import { ButtonRow, FormScroll, Heading, SkeletonList, StatusBadge } from './ui';

function useDashboardData() {
  const { user } = useAuth();
  const today = todayString();
  const uid = user?.id;
  const profile = useTeacherProfile();
  const attendance = useRemoteData(uid ? `dash-att:${uid}:${today}` : null, () => attendanceApi.list({ date: today, limit: 50 }));
  const homework = useRemoteData(uid ? `dash-hw:${uid}` : null, () => homeworkApi.list({ status: 'PUBLISHED', limit: 1 }));
  const quizzes = useRemoteData(uid ? `dash-quiz:${uid}` : null, () => quizApi.list({ status: 'PUBLISHED', limit: 1 }));
  const overview = useRemoteData(uid ? `dash-overview:${uid}` : null, () => performanceApi.getTeacherOverview());
  const refreshAll = () => { void profile.refresh(); void attendance.refresh(); void homework.refresh(); void quizzes.refresh(); void overview.refresh(); };
  return { today, profile, attendance, homework, quizzes, overview, refreshAll, refreshing: profile.refreshing || attendance.refreshing };
}

export function TeacherDashboardScreen() {
  const { today, profile, attendance, homework, quizzes, overview, refreshAll, refreshing } = useDashboardData();
  const data = profile.data;
  const scopes = useMemo(() => sectionScopes(activeAssignments(data)), [data]);
  const years = academicYears(data).filter((year) => year.isActive);
  const sessions = attendance.data?.items ?? [];
  const sessionFor = (classId: string, sectionId: string) => sessions.find((session) => session.classId === classId && session.sectionId === sectionId);
  const submittedToday = scopes.filter((scope) => sessionFor(scope.classId, scope.sectionId)?.status === 'SUBMITTED').length;
  const draftToday = scopes.filter((scope) => sessionFor(scope.classId, scope.sectionId)?.status === 'DRAFT').length;

  return (
    <FormScroll testID="teacher-dashboard" refreshing={refreshing} onRefresh={refreshAll}>
      {profile.loading ? <SkeletonList rows={2} /> : null}
      {profile.error ? <ErrorPanel error={profile.error} onRetry={profile.reload} /> : null}
      {data ? (
        <Heading title={`Hello, ${data.name}`} subtitle={`${data.organization.name} · ${displayDate(today)}${years.length ? ` · ${years.map((year) => year.name).join(', ')}` : ''}`} />
      ) : null}

      <Section title="Quick actions">
        <ButtonRow>
          <AppButton title="Mark attendance" onPress={() => router.push('/attendance')} />
          <AppButton title="Create homework" onPress={() => router.push('/assignments/create')} />
          <AppButton title="Create quiz" onPress={() => router.push('/quizzes/create')} />
          <AppButton title="Review submissions" onPress={() => router.push('/assignments')} />
          <AppButton title="View performance" onPress={() => router.push('/class-performance')} />
        </ButtonRow>
      </Section>

      <Section title="Today at a glance">
        {data && scopes.length === 0 ? <EmptyState title="No class assignments" detail="Ask your school administrator to assign you to a class and subject." /> : null}
        <View style={styles.tiles}>
          <Tile label="Assigned sections" value={data ? String(scopes.length) : '—'} detail={data ? `${new Set(activeAssignments(data).map((assignment) => assignment.subjectId)).size} subjects` : null} />
          <Tile label="Attendance today" value={attendance.data ? `${submittedToday}/${scopes.length}` : '—'} detail={attendance.error ? 'Could not load' : draftToday ? `${draftToday} saved as draft` : 'sections submitted'} />
          <Tile label="Active homework" value={homework.data ? String(homework.data.meta.total) : '—'} detail={homework.error ? 'Could not load' : 'published'} />
          <Tile label="Active quizzes" value={quizzes.data ? String(quizzes.data.meta.total) : '—'} detail={quizzes.error ? 'Could not load' : 'published'} />
          <Tile label="Homework to grade" value={overview.data ? String(overview.data.totals.pendingHomeworkReviews) : '—'} detail={overview.error ? 'Could not load' : 'this academic year'} />
          <Tile label="Quizzes to evaluate" value={overview.data ? String(overview.data.totals.pendingQuizReviews) : '—'} detail={overview.error ? 'Could not load' : 'this academic year'} />
        </View>
        {overview.error || attendance.error ? <AppButton title="Retry summary" onPress={() => { attendance.reload(); overview.reload(); }} /> : null}
      </Section>

      {scopes.length ? (
        <Section title="Attendance today">
          {scopes.map((scope) => {
            const session = sessionFor(scope.classId, scope.sectionId);
            const status = session?.status;
            return (
              <Pressable key={scope.key} accessibilityRole="button" accessibilityLabel={`${scope.label} attendance ${status ?? 'not taken'}`} onPress={() => router.push({ pathname: '/attendance', params: { classId: scope.classId, sectionId: scope.sectionId, date: today } })}>
                <AppCard style={styles.row}>
                  <AppText style={styles.rowTitle}>{scope.label}</AppText>
                  {status ? <StatusBadge status={status} /> : <StatusBadge status="NOT_TAKEN" label="Not taken" />}
                </AppCard>
              </Pressable>
            );
          })}
        </Section>
      ) : null}
    </FormScroll>
  );
}

export function TeacherClassesScreen() {
  const profile = useTeacherProfile();
  const years = academicYears(profile.data);
  const [yearId, setYearId] = useState<string | null>(null);
  const selectedYear = yearId ?? years.find((year) => year.isActive)?.id ?? years[0]?.id ?? null;
  const scopes = sectionScopes(activeAssignments(profile.data, selectedYear));

  return (
    <FormScroll refreshing={profile.refreshing} onRefresh={() => void profile.refresh()}>
      <Heading title="My classes" subtitle="Only the classes, sections and subjects assigned to you." />
      {profile.loading ? <SkeletonList /> : null}
      {profile.error ? <ErrorPanel error={profile.error} onRetry={profile.reload} /> : null}
      {years.length > 1 ? (
        <View accessibilityLabel="Academic year" style={styles.chips}>
          {years.map((year) => (
            <Pressable key={year.id} accessibilityRole="radio" accessibilityState={{ checked: year.id === selectedYear }} accessibilityLabel={`Academic year ${year.name}`} onPress={() => setYearId(year.id)} style={[styles.chip, year.id === selectedYear && styles.chipActive]}>
              <AppText style={[styles.chipText, year.id === selectedYear && styles.chipTextActive]}>{year.name}{year.isActive ? ' (current)' : ''}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {profile.data && scopes.length === 0 ? <EmptyState title="No class assignments" detail="You have no active class assignments. Ask your school administrator." /> : null}
      {scopes.map((scope) => (
        <AppCard key={scope.key} style={styles.cardGap}>
          <AppText style={styles.rowTitle}>{scope.label}</AppText>
          <AppText style={styles.muted}>Subjects: {scope.subjects.map((subject) => subject.name).join(', ')}</AppText>
          <ButtonRow>
            <AppButton title="Attendance" onPress={() => router.push({ pathname: '/attendance', params: { classId: scope.classId, sectionId: scope.sectionId } })} />
            <AppButton title="Homework" onPress={() => router.push({ pathname: '/assignments', params: { classId: scope.classId, sectionId: scope.sectionId } })} />
            <AppButton title="Quizzes" onPress={() => router.push({ pathname: '/quizzes', params: { classId: scope.classId, sectionId: scope.sectionId } })} />
            <AppButton title="Performance" onPress={() => router.push({ pathname: '/section/[classId]/[sectionId]', params: { classId: scope.classId, sectionId: scope.sectionId } })} />
          </ButtonRow>
        </AppCard>
      ))}
    </FormScroll>
  );
}

export function TeacherManageScreen() {
  const items = [
    { title: 'Attendance', detail: 'Mark, save and submit daily attendance.', action: 'Take attendance', onPress: () => router.push('/attendance'), secondary: { title: 'History', onPress: () => router.push('/attendance/history') } },
    { title: 'Homework', detail: 'Create homework and grade student submissions.', action: 'Open homework', onPress: () => router.push('/assignments'), secondary: { title: 'Create', onPress: () => router.push('/assignments/create') } },
    { title: 'Quizzes', detail: 'Build quizzes and evaluate student attempts.', action: 'Open quizzes', onPress: () => router.push('/quizzes'), secondary: { title: 'Create', onPress: () => router.push('/quizzes/create') } },
    { title: 'Performance', detail: 'Class, subject and student analytics.', action: 'View performance', onPress: () => router.push('/class-performance'), secondary: null },
  ];
  return (
    <FormScroll>
      <Heading title="Manage" subtitle="Daily academic operations" />
      {items.map((item) => (
        <AppCard key={item.title} style={styles.cardGap}>
          <AppText style={styles.rowTitle}>{item.title}</AppText>
          <AppText style={styles.muted}>{item.detail}</AppText>
          <ButtonRow>
            <AppButton title={item.action} onPress={item.onPress} />
            {item.secondary ? <AppButton title={item.secondary.title} onPress={item.secondary.onPress} /> : null}
          </ButtonRow>
        </AppCard>
      ))}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 56 },
  rowTitle: { fontSize: 17, fontWeight: '700' },
  muted: { color: colors.muted, lineHeight: 20 },
  cardGap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
});
