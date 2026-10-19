import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href, useFocusEffect } from 'expo-router';
import { BookOpenCheck, ClipboardList } from 'lucide-react-native';

import { studentWorkApi } from '@/api/academics/student-work';
import { normalizeApiError } from '@/api/client/error';
import type { StudentHomeworkSummary, StudentQuizSummary } from '@/api/contracts/student-work';
import { AppButton, AppCard, AppScreen, AppText, EmptyState, ErrorState } from '@/design-system/components';
import { DailyTasksSection } from '@/features/learning/DailyTasks';
import { useInstitutionExperience } from '@/features/learning/experience-store';
import { colors, radius, spacing } from '@/design-system/tokens';
import { formatDate, formatDateTime, homeworkStatus, latestQuizAttempt, quizStatus, type WorkStatusPresentation } from '../work-utils';

type TabKey = 'daily' | 'quizzes' | 'homework';

type LoadState = {
  quizzes: StudentQuizSummary[];
  homework: StudentHomeworkSummary[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

const initialState: LoadState = { quizzes: [], homework: [], loading: true, refreshing: false, error: null };

export default function StudentTasksScreen() {
  const institution = useInstitutionExperience();
  const [activeTab, setActiveTab] = useState<TabKey>(institution ? 'daily' : 'quizzes');
  const [state, setState] = useState<LoadState>(initialState);

  const load = useCallback(async (refreshing = false) => {
    setState((current) => ({ ...current, loading: !refreshing, refreshing, error: null }));
    try {
      const [quizzes, homework] = await Promise.all([
        studentWorkApi.listQuizzes(),
        studentWorkApi.listHomework(),
      ]);
      setState({ quizzes, homework, loading: false, refreshing: false, error: null });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: normalizeApiError(error).message,
      }));
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const counts = useMemo(() => ({
    quizzes: state.quizzes.length,
    homework: state.homework.length,
  }), [state.homework.length, state.quizzes.length]);

  const retry = () => void load();
  const refresh = () => void load(true);

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <AppText style={styles.eyebrow}>Assigned work</AppText>
        <AppText style={styles.title}>Tasks</AppText>
        <AppText style={styles.subtitle}>Quizzes and homework published for your class appear here.</AppText>
      </View>

      <View style={styles.segment}>
        {institution ? <SegmentButton active={activeTab === 'daily'} label="Daily" onPress={() => setActiveTab('daily')} /> : null}
        <SegmentButton active={activeTab === 'quizzes'} label={`Quizzes ${counts.quizzes}`} onPress={() => setActiveTab('quizzes')} />
        <SegmentButton active={activeTab === 'homework'} label={`Homework ${counts.homework}`} onPress={() => setActiveTab('homework')} />
      </View>

      {activeTab === 'daily' ? <ScrollView contentContainerStyle={styles.list}><DailyTasksSection /></ScrollView> : null}

      {activeTab !== 'daily' && state.loading ? <SkeletonList /> : null}

      {activeTab !== 'daily' && !state.loading && state.error ? (
        <View style={styles.stateWrap}>
          <ErrorState message={state.error} />
          <AppButton title="Retry" onPress={retry} />
        </View>
      ) : null}

      {!state.loading && !state.error && activeTab === 'quizzes' ? (
        <FlatList
          data={state.quizzes}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          contentContainerStyle={state.quizzes.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<EmptyState title="No quizzes assigned" detail="Published quizzes with questions will appear here." />}
          renderItem={({ item }) => <QuizCard quiz={item} />}
        />
      ) : null}

      {!state.loading && !state.error && activeTab === 'homework' ? (
        <FlatList
          data={state.homework}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          contentContainerStyle={state.homework.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<EmptyState title="No homework assigned" detail="Homework published by your teachers will appear here." />}
          renderItem={({ item }) => <HomeworkCard homework={item} />}
        />
      ) : null}
    </AppScreen>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <AppText style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</AppText>
    </Pressable>
  );
}

function QuizCard({ quiz }: { quiz: StudentQuizSummary }) {
  const status = quizStatus(quiz);
  const attempt = latestQuizAttempt(quiz);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/(student)/quiz/${quiz.id}` as Href)}>
      <AppCard style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.iconBubble}><ClipboardList color={colors.student} size={20} /></View>
          <StatusPill status={status} />
        </View>
        <AppText style={styles.cardTitle}>{quiz.title}</AppText>
        <MetaLine label="Subject" value={quiz.subject?.name ?? 'Subject not specified'} />
        <MetaLine label="Assigned" value={formatDate(quiz.createdAt)} />
        <MetaLine label="Duration" value={`${quiz.durationMinutes} min`} />
        {attempt?.submittedAt ? <MetaLine label="Submitted" value={formatDateTime(attempt.submittedAt)} /> : null}
      </AppCard>
    </Pressable>
  );
}

function HomeworkCard({ homework }: { homework: StudentHomeworkSummary }) {
  const status = homeworkStatus(homework);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/(student)/homework/${homework.id}` as Href)}>
      <AppCard style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.iconBubble}><BookOpenCheck color={colors.primary} size={20} /></View>
          <StatusPill status={status} />
        </View>
        <AppText style={styles.cardTitle}>{homework.title}</AppText>
        <MetaLine label="Subject" value={homework.subject?.name ?? 'Subject not specified'} />
        <MetaLine label="Deadline" value={formatDate(homework.dueDate)} />
        <MetaLine label="Questions" value={`${homework.questionCount}`} />
        {homework.totalMarks !== null ? <MetaLine label="Marks" value={`${homework.totalMarks}`} /> : null}
      </AppCard>
    </Pressable>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaLine}>
      <AppText style={styles.metaLabel}>{label}</AppText>
      <AppText style={styles.metaValue}>{value}</AppText>
    </View>
  );
}

function StatusPill({ status }: { status: WorkStatusPresentation }) {
  const toneStyles: Record<WorkStatusPresentation['tone'], object> = {
    success: styles.pill_success,
    warning: styles.pill_warning,
    danger: styles.pill_danger,
    muted: styles.pill_muted,
    info: styles.pill_info,
  };
  return <View style={[styles.pill, toneStyles[status.tone]]}><AppText style={styles.pillText}>{status.label}</AppText></View>;
}

function SkeletonList() {
  return (
    <View style={styles.list}>
      {[0, 1, 2].map((item) => <View key={item} style={styles.skeletonCard}><View style={styles.skeletonTitle} /><View style={styles.skeletonLine} /><View style={styles.skeletonLineShort} /></View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  header: { gap: spacing.xs },
  eyebrow: { color: colors.student, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, lineHeight: 22 },
  segment: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', padding: 4 },
  segmentButton: { alignItems: 'center', borderRadius: radius.md, flex: 1, minHeight: 40, justifyContent: 'center' },
  segmentButtonActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
  emptyList: { flexGrow: 1 },
  stateWrap: { flex: 1, gap: spacing.md },
  card: { gap: spacing.sm },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  iconBubble: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  cardTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  metaLine: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  metaLabel: { color: colors.muted, flexShrink: 0, fontSize: 13 },
  metaValue: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  pill: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  pill_success: { backgroundColor: colors.success },
  pill_warning: { backgroundColor: colors.parent },
  pill_danger: { backgroundColor: colors.danger },
  pill_muted: { backgroundColor: colors.muted },
  pill_info: { backgroundColor: colors.student },
  skeletonCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  skeletonTitle: { backgroundColor: colors.border, borderRadius: radius.sm, height: 24, width: '70%' },
  skeletonLine: { backgroundColor: colors.border, borderRadius: radius.sm, height: 14, width: '90%' },
  skeletonLineShort: { backgroundColor: colors.border, borderRadius: radius.sm, height: 14, width: '55%' },
});
