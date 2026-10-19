import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback } from 'react';

import { learningApi } from '@/api/academics/learning';
import type { LearningTask, TaskState } from '@/api/contracts/learning';
import { AppCard, AppText } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { useAuth } from '@/auth/AuthProvider';

import { dueText, percentLabel } from './LearningHomeScreen';

const STATE_LABEL: Record<TaskState, string> = {
  PENDING: 'To do',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  GRADED: 'Result ready',
};

/** Assigned daily quizzes, shown above the standard quiz and homework lists for the institution experience. */
export function DailyTasksSection() {
  const { user } = useAuth();
  const tasks = useRemoteData(user ? `learning-tasks:${user.id}` : null, () => learningApi.tasks());
  const refresh = tasks.refresh;
  useFocusEffect(useCallback(() => { if (user) void refresh(); }, [user, refresh]));

  const items = tasks.data ?? [];
  const open = items.filter((task) => task.state === 'PENDING' || task.state === 'IN_PROGRESS');
  const done = items.filter((task) => task.state === 'SUBMITTED' || task.state === 'GRADED');
  if (tasks.loading) return null;

  return (
    <View style={styles.wrap}>
      <AppText style={styles.title}>Daily tasks</AppText>
      {tasks.error ? <AppText style={styles.muted}>{tasks.error.message}</AppText> : null}
      {items.length === 0 && !tasks.error ? <AppText style={styles.muted}>No daily tasks are assigned right now.</AppText> : null}
      {open.map((task) => <TaskCard key={task.assignmentId} task={task} />)}
      {done.length > 0 ? <AppText style={styles.subtitle}>Completed</AppText> : null}
      {done.map((task) => <TaskCard key={task.assignmentId} task={task} />)}
    </View>
  );
}

function TaskCard({ task }: { task: LearningTask }) {
  const canOpen = task.state === 'PENDING' || task.state === 'IN_PROGRESS' || task.attemptId !== null;
  return (
    <Pressable accessibilityRole="button" disabled={!canOpen} onPress={() => router.push(`/(student)/quiz/${task.quizId}` as Href)}>
      <AppCard style={styles.card}>
        <View style={styles.top}>
          <AppText style={styles.cardTitle}>{task.title}</AppText>
          <AppText style={[styles.pill, task.overdue && styles.pillLate]}>{task.overdue ? 'Past due' : STATE_LABEL[task.state]}</AppText>
        </View>
        <AppText style={styles.muted}>For {task.assignedDate} · due {dueText(task.dueAt)} · {task.durationMinutes} min</AppText>
        {task.result ? <AppText style={styles.muted}>Score {percentLabel(task.result.percentage)}</AppText> : task.state === 'SUBMITTED' ? <AppText style={styles.muted}>Result not released yet</AppText> : null}
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.muted, fontWeight: '700', marginTop: spacing.sm },
  card: { gap: spacing.xs },
  top: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 20 },
  pill: { backgroundColor: colors.primary, borderRadius: 999, color: '#fff', fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 4 },
  pillLate: { backgroundColor: colors.parent },
});
