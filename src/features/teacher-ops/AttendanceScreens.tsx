import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { attendanceApi } from '@/api/academics/teacher-ops';
import type { AttendanceRoster, AttendanceSessionStatus, AttendanceSessionSummary } from '@/api/contracts/teacher-ops';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppText, EmptyState } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';
import { Chips, ErrorPanel, Notice, Row, Section } from '@/features/performance/components';
import { isUncertainOutcome } from '@/features/performance/format';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { confirmAction, useAction, useLoadMore, useTeacherProfile } from './hooks';
import { activeAssignments, attendanceCounts, buildRecordSnapshot, displayDate, displayDateTime, effectiveStatus, hasUnsavedChanges, isValidDateString, sectionScopes, shiftDate, todayString, type EditMap } from './logic';
import { BackButton, ButtonRow, Field, FormScroll, Heading, SkeletonList, StatusBadge } from './ui';

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

// ------------------------------------------------------------- take attendance

export function AttendanceScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ classId?: string; sectionId?: string; date?: string }>();
  const profile = useTeacherProfile();
  const scopes = useMemo(() => sectionScopes(activeAssignments(profile.data)), [profile.data]);
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState(() => (isValidDateString(param(params.date)) ? param(params.date) : todayString()));
  const [edits, setEdits] = useState<{ key: string; map: EditMap }>({ key: '', map: {} });
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();

  const requested = scopes.find((scope) => scope.classId === param(params.classId) && scope.sectionId === param(params.sectionId));
  const scope = scopes.find((entry) => entry.key === scopeKey) ?? requested ?? scopes[0] ?? null;
  const dateValid = isValidDateString(dateInput);
  const rosterKey = user && scope && dateValid ? `roster:${user.id}:${scope.classId}:${scope.sectionId}:${dateInput}` : null;
  const roster = useRemoteData<AttendanceRoster>(rosterKey, () => attendanceApi.getRoster({ classId: (scope as NonNullable<typeof scope>).classId, sectionId: (scope as NonNullable<typeof scope>).sectionId, date: dateInput, academicYearId: (scope as NonNullable<typeof scope>).academicYearId }));

  const data = roster.data;
  const locked = Boolean(data?.locked);
  const currentEdits: EditMap = rosterKey && edits.key === rosterKey && !locked ? edits.map : {};
  const students = data?.students ?? [];
  const counts = attendanceCounts(students, currentEdits);
  const dirty = hasUnsavedChanges(students, currentEdits);
  const sessionStatus: AttendanceSessionStatus | null = data?.session?.status ?? null;

  const setStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    if (!rosterKey || locked) return;
    setNotice(null);
    setEdits((current) => ({ key: rosterKey, map: { ...(current.key === rosterKey ? current.map : {}), [studentId]: status } }));
  };
  const setAll = (status: 'PRESENT' | 'ABSENT') => {
    if (!rosterKey || locked) return;
    setNotice(null);
    setEdits({ key: rosterKey, map: Object.fromEntries(students.map((student) => [student.studentId, status])) });
  };

  const guardUnsaved = async () => {
    if (!dirty) return true;
    return confirmAction('Discard unsaved changes?', 'You have attendance changes that are not saved. Switching will discard them.', 'Discard', true);
  };
  const chooseScope = async (key: string) => {
    if (key === scope?.key || !(await guardUnsaved())) return;
    setScopeKey(key);
    setEdits({ key: '', map: {} });
    setNotice(null);
  };
  const chooseDate = async (value: string) => {
    if (value === dateInput || !(await guardUnsaved())) return;
    setDateInput(value);
    setEdits({ key: '', map: {} });
    setNotice(null);
  };

  // Official draft on the backend: create-or-reuse the session, then save the full snapshot.
  const persist = async () => {
    const target = scope as NonNullable<typeof scope>;
    const session: AttendanceSessionSummary = data?.session ?? (await attendanceApi.createSession({ classId: target.classId, sectionId: target.sectionId, date: dateInput, academicYearId: target.academicYearId }));
    await attendanceApi.saveRecords(session.id, buildRecordSnapshot(students, currentEdits));
    return session;
  };

  const reconcile = async (error: { status?: number }) => {
    // The server may or may not have applied the change: re-read the official state, keep local edits.
    if (isUncertainOutcome(error)) roster.reload();
  };

  const saveDraft = async () => {
    if (!scope || !students.length) return;
    const result = await action.run(persist);
    if (!result) return;
    if (!result.ok) return void (await reconcile(result.error));
    setEdits({ key: '', map: {} });
    setNotice('Draft saved. Attendance is not final until you submit it.');
    roster.reload();
  };

  const submit = async () => {
    if (!scope || !students.length) return;
    const result = await action.run(async () => {
      const session = await persist();
      await attendanceApi.submit(session.id);
    }, () => confirmAction('Submit attendance?', `Submit ${counts.present} present and ${counts.absent} absent for ${scope.label} on ${displayDate(dateInput)}? Submitted attendance can no longer be edited.`, 'Submit'));
    if (!result) return;
    if (!result.ok) return void (await reconcile(result.error));
    setEdits({ key: '', map: {} });
    setNotice('Attendance submitted.');
    roster.reload();
  };

  return (
    <FormScroll testID="attendance-screen" refreshing={roster.refreshing} onRefresh={() => void roster.refresh()}>
      <BackButton />
      <Heading title="Attendance" subtitle="Choose a section and date, mark students, then save a draft or submit." />
      {profile.loading ? <SkeletonList rows={1} /> : null}
      {profile.error ? <ErrorPanel error={profile.error} onRetry={profile.reload} /> : null}
      {profile.data && scopes.length === 0 ? <EmptyState title="No class assignments" detail="You are not assigned to any class this year." /> : null}
      {scopes.length ? <Chips label="Section" options={scopes.map((entry) => ({ id: entry.key, label: entry.label }))} value={scope?.key ?? ''} onChange={(key) => void chooseScope(key)} /> : null}
      {scopes.length ? (
        <View style={styles.cardGap}>
          <Field label="Date (YYYY-MM-DD)" value={dateInput} onChangeText={(value) => void chooseDate(value.trim())} autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} error={dateValid ? null : 'Enter a real date in YYYY-MM-DD format.'} />
          <ButtonRow>
            <AppButton title="Today" onPress={() => void chooseDate(todayString())} />
            <AppButton title="Yesterday" onPress={() => void chooseDate(shiftDate(todayString(), -1))} />
          </ButtonRow>
          {dateValid && dateInput > todayString() ? <Notice tone="warning">This date is in the future.</Notice> : null}
        </View>
      ) : null}

      {roster.error ? <ErrorPanel error={roster.error.forbidden ? { ...roster.error, message: 'You are not assigned to this class and section.' } : roster.error} onRetry={roster.reload} /> : null}
      {roster.loading ? <SkeletonList /> : null}
      {notice ? <Notice>{notice}</Notice> : null}
      {action.error ? <ErrorPanel error={action.error} onRetry={action.clearError} /> : null}

      {data && scope ? (
        <>
          <AppCard style={styles.cardGap}>
            <View style={styles.rowBetween}>
              <AppText style={styles.title}>{scope.label} · {displayDate(dateInput)}</AppText>
              {sessionStatus ? <StatusBadge status={sessionStatus} /> : <StatusBadge status="NOT_TAKEN" label="Not started" />}
            </View>
            <Row label="Present" value={String(counts.present)} />
            <Row label="Absent" value={String(counts.absent)} />
            <Row label="Students" value={String(counts.total)} />
            {data.session?.submittedBy?.fullName ? <Row label="Submitted by" value={`${data.session.submittedBy.fullName}${data.session.submittedAt ? ` · ${displayDateTime(data.session.submittedAt)}` : ''}`} /> : null}
            {dirty ? <AppText accessibilityRole="alert" style={styles.warn}>You have unsaved changes.</AppText> : null}
          </AppCard>

          {locked ? <Notice>This attendance has been submitted and is read-only.</Notice> : null}
          {students.length === 0 ? <EmptyState title="No students" detail="There are no active students on this roster." /> : null}

          {!locked && students.length ? (
            <ButtonRow>
              <AppButton title="Mark all present" onPress={() => setAll('PRESENT')} disabled={action.busy} />
              <AppButton title="Mark all absent" onPress={() => setAll('ABSENT')} disabled={action.busy} />
            </ButtonRow>
          ) : null}

          <Section title="Students">
            {students.map((student) => {
              const status = effectiveStatus(student, currentEdits);
              return (
                <AppCard key={student.studentId} style={styles.studentRow}>
                  <View style={styles.studentName}>
                    <AppText style={styles.rowTitle}>{student.fullName}</AppText>
                    {student.rollNumber ? <AppText style={styles.muted}>Roll {student.rollNumber}</AppText> : null}
                  </View>
                  {locked ? (
                    <StatusBadge status={status === 'PRESENT' ? 'SUBMITTED' : 'ABSENT'} label={status === 'PRESENT' ? 'Present' : 'Absent'} />
                  ) : (
                    <View accessibilityLabel={`${student.fullName} attendance`} style={styles.toggle}>
                      {(['PRESENT', 'ABSENT'] as const).map((option) => (
                        <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: status === option }} accessibilityLabel={`${student.fullName}: ${option === 'PRESENT' ? 'Present' : 'Absent'}`} onPress={() => setStatus(student.studentId, option)} style={[styles.toggleOption, status === option && (option === 'PRESENT' ? styles.togglePresent : styles.toggleAbsent)]}>
                          <AppText style={[styles.toggleText, status === option && styles.toggleTextActive]}>{option === 'PRESENT' ? 'Present' : 'Absent'}</AppText>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </AppCard>
              );
            })}
          </Section>

          {!locked && students.length ? (
            <ButtonRow>
              <AppButton title="Save draft" loading={action.busy} disabled={action.busy} onPress={() => void saveDraft()} />
              <AppButton title="Submit attendance" loading={action.busy} disabled={action.busy} onPress={() => void submit()} />
            </ButtonRow>
          ) : null}
        </>
      ) : null}
      <AppButton title="Attendance history" onPress={() => router.push('/attendance/history')} />
    </FormScroll>
  );
}

// -------------------------------------------------------------------- history

const STATUS_FILTERS: { id: 'ALL' | AttendanceSessionStatus; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Drafts' },
  { id: 'SUBMITTED', label: 'Submitted' },
];

export function AttendanceHistoryScreen() {
  const { user } = useAuth();
  const profile = useTeacherProfile();
  const scopes = useMemo(() => sectionScopes(activeAssignments(profile.data)), [profile.data]);
  const [scopeKey, setScopeKey] = useState('all');
  const [status, setStatus] = useState<'ALL' | AttendanceSessionStatus>('ALL');
  const [dateInput, setDateInput] = useState('');
  const scope = scopes.find((entry) => entry.key === scopeKey) ?? null;
  const dateValid = dateInput === '' || isValidDateString(dateInput);
  const key = user && dateValid ? `att-history:${user.id}:${scope?.key ?? 'all'}:${status}:${dateInput}` : null;
  const query = (page: number) => ({ page, limit: 20, classId: scope?.classId, sectionId: scope?.sectionId, academicYearId: scope?.academicYearId, status: status === 'ALL' ? undefined : status, date: dateInput || undefined });
  const first = useRemoteData(key, () => attendanceApi.list(query(1)));
  const list = useLoadMore(first.data, (page) => attendanceApi.list(query(page)));
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <FormScroll refreshing={first.refreshing} onRefresh={() => void first.refresh()}>
      <BackButton />
      <Heading title="Attendance history" subtitle="Sessions for your assigned sections. The server filters by a single date." />
      <Chips label="Section" options={[{ id: 'all', label: 'All sections' }, ...scopes.map((entry) => ({ id: entry.key, label: entry.label }))]} value={scopeKey} onChange={setScopeKey} />
      <Chips label="State" options={STATUS_FILTERS} value={status} onChange={setStatus} />
      <Field label="Date filter (optional, YYYY-MM-DD)" value={dateInput} onChangeText={(value) => setDateInput(value.trim())} autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} error={dateValid ? null : 'Enter a real date in YYYY-MM-DD format.'} />
      {first.error ? <ErrorPanel error={first.error} onRetry={first.reload} /> : null}
      {first.loading ? <SkeletonList /> : null}
      {first.data ? <AppText style={styles.muted}>Showing {list.items.length} of {list.total} sessions</AppText> : null}
      {first.data && list.items.length === 0 ? <EmptyState title="No attendance sessions" detail="Nothing matches these filters." /> : null}
      {list.items.map((session) => (
        <HistoryRow key={session.id} session={session} open={openId === session.id} onToggle={() => setOpenId(openId === session.id ? null : session.id)} />
      ))}
      {list.error ? <ErrorPanel error={list.error} onRetry={() => void list.loadMore()} /> : null}
      {list.hasMore ? <AppButton title="Load more sessions" loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
    </FormScroll>
  );
}

function HistoryRow({ session, open, onToggle }: { session: AttendanceSessionSummary; open: boolean; onToggle: () => void }) {
  const detail = useRemoteData(open && session.status === 'SUBMITTED' ? `att-session:${session.id}` : null, () => attendanceApi.get(session.id));
  const present = detail.data?.records.filter((record) => record.status === 'PRESENT').length ?? 0;
  const absent = detail.data?.records.filter((record) => record.status === 'ABSENT').length ?? 0;
  return (
    <AppCard style={styles.cardGap}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${session.class.name} ${session.section.name} ${displayDate(session.date)} ${session.status}`} onPress={onToggle}>
        <View style={styles.rowBetween}>
          <View style={styles.studentName}>
            <AppText style={styles.rowTitle}>{session.class.name} {session.section.name}</AppText>
            <AppText style={styles.muted}>{displayDate(session.date)}{session._count ? ` · ${session._count.records} records` : ''}</AppText>
          </View>
          <StatusBadge status={session.status} />
        </View>
      </Pressable>
      {open && session.status === 'DRAFT' ? (
        <AppButton title="Resume draft" onPress={() => router.push({ pathname: '/attendance', params: { classId: session.classId, sectionId: session.sectionId, date: session.date.slice(0, 10) } })} />
      ) : null}
      {open && session.status === 'SUBMITTED' ? (
        <View style={styles.cardGap}>
          {detail.loading ? <SkeletonList rows={1} /> : null}
          {detail.error ? <ErrorPanel error={detail.error} onRetry={detail.reload} /> : null}
          {detail.data ? (
            <>
              <Row label="Present" value={String(present)} />
              <Row label="Absent" value={String(absent)} />
              {session.submittedBy?.fullName ? <Row label="Submitted by" value={`${session.submittedBy.fullName}${session.submittedAt ? ` · ${displayDateTime(session.submittedAt)}` : ''}`} /> : null}
              <AppText style={styles.muted}>Submitted attendance is read-only.</AppText>
            </>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  cardGap: { gap: spacing.sm },
  title: { flexShrink: 1, fontSize: 17, fontWeight: '800' },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  muted: { color: colors.muted, lineHeight: 20 },
  warn: { color: '#8A5A16', fontWeight: '700' },
  rowBetween: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  studentRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  studentName: { flex: 1, gap: 2 },
  toggle: { flexDirection: 'row', gap: spacing.xs },
  toggleOption: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 76, paddingHorizontal: spacing.sm, alignItems: 'center' },
  togglePresent: { backgroundColor: colors.success, borderColor: colors.success },
  toggleAbsent: { backgroundColor: colors.danger, borderColor: colors.danger },
  toggleText: { color: colors.text, fontSize: 14 },
  toggleTextActive: { color: '#fff', fontWeight: '700' },
});
