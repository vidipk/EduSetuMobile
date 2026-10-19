import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { learningApi } from '@/api/academics/learning';
import type { LearningHome, LearningTask } from '@/api/contracts/learning';
import { AppButton, AppCard, AppScreen, AppText, ErrorState, LoadingState } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { useAuth } from '@/auth/AuthProvider';

import { useLearningExperience } from './experience-store';
import { Mascot } from './Mascot';
import { openLecture } from './open-video';

export function dueText(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function percentLabel(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10}%` : '—';
}

export function LearningHomeScreen() {
  const { user } = useAuth();
  const config = useLearningExperience((state) => state.config);
  const home = useRemoteData(user ? `learning-home:${user.id}` : null, () => learningApi.home());
  const [reduceOverride, setReduceOverride] = useState<boolean | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  if (home.loading) return <AppScreen><LoadingState label="Loading your learning..." /></AppScreen>;
  if (home.error && !home.data) {
    return (
      <AppScreen style={styles.screen}>
        <ErrorState message={home.error.message} />
        <AppButton title="Try again" onPress={home.reload} />
      </AppScreen>
    );
  }
  const data = home.data as LearningHome;
  const reduce = reduceOverride ?? data.mascot.reduceAnimations;

  const toggleReduce = (value: boolean) => {
    setReduceOverride(value);
    void learningApi.setReduceAnimations(value).catch(() => setReduceOverride(null));
  };

  const resume = async () => {
    if (!data.continueLearning) return;
    const outcome = await openLecture(data.continueLearning);
    setOpenError(outcome === 'failed' || outcome === 'blocked' ? 'This lecture could not be opened right now.' : null);
  };

  return (
    <AppScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={home.refreshing} onRefresh={() => void home.refresh()} tintColor={colors.primary} />}>
        <View style={styles.header}>
          <AppText style={styles.eyebrow}>{data.learner.organizationName ?? 'Your learning'}</AppText>
          <AppText style={styles.title}>Welcome, {data.learner.fullName.split(' ')[0]}</AppText>
          {data.learner.className ? <AppText style={styles.muted}>Class {data.learner.className}</AppText> : null}
        </View>

        {data.mascot.enabled ? (
          <Mascot name={config?.mascot.name ?? null} assetKey={config?.mascot.assetKey ?? null} state={data.mascot.state} message={data.mascot.message} reduceAnimations={reduce} />
        ) : null}

        <View style={styles.statRow}>
          <Stat label="Day streak" value={`${data.streak.current}`} hint={data.streak.longest > 0 ? `Best ${data.streak.longest}` : 'Complete a quiz to begin'} />
          <Stat label="Quizzes done" value={`${data.quizStatistics.completed}`} hint={data.quizStatistics.averagePercentage === null ? 'Results appear once released' : `Average ${percentLabel(data.quizStatistics.averagePercentage)}`} />
        </View>

        <Section title="Today's quiz">
          {data.pendingToday.length === 0 ? (
            <AppText style={styles.muted}>Nothing is assigned for today.</AppText>
          ) : (
            data.pendingToday.map((task) => <TaskRow key={task.assignmentId} task={task} />)
          )}
        </Section>

        {data.continueLearning ? (
          <Section title="Continue learning">
            <AppCard style={styles.card}>
              <AppText style={styles.cardTitle}>{data.continueLearning.title}</AppText>
              <AppText style={styles.muted}>Opens in the YouTube app. Watching is not tracked as completion.</AppText>
              <AppButton title="Open lecture" onPress={() => void resume()} />
              {openError ? <AppText accessibilityRole="alert" style={styles.error}>{openError}</AppText> : null}
            </AppCard>
          </Section>
        ) : null}

        {data.recommendedRevision.length > 0 ? (
          <Section title="Worth revising">
            {data.recommendedRevision.map((topic) => (
              <AppCard key={topic.topicId} style={styles.card}>
                <AppText style={styles.cardTitle}>{topic.name}</AppText>
                <AppText style={styles.muted}>Your recent average here is {percentLabel(topic.averagePercentage)}. A short review may help.</AppText>
              </AppCard>
            ))}
          </Section>
        ) : null}

        <Section title="Recently completed">
          {data.recentActivity.length === 0 ? (
            <AppText style={styles.muted}>Completed quizzes will appear here.</AppText>
          ) : (
            data.recentActivity.map((activity) => (
              <AppCard key={activity.attemptId} style={styles.card}>
                <AppText style={styles.cardTitle}>{activity.title}</AppText>
                <AppText style={styles.muted}>
                  {activity.resultReleased ? `Score ${percentLabel(activity.percentage)}` : 'Submitted · result not released yet'}
                </AppText>
              </AppCard>
            ))
          )}
        </Section>

        <AppButton title="View my performance" onPress={() => router.push('/performance' as Href)} />

        {data.mascot.enabled ? (
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <AppText style={styles.cardTitle}>Reduce animations</AppText>
              <AppText style={styles.muted}>Keeps the guide still.</AppText>
            </View>
            <Switch accessibilityLabel="Reduce animations" value={reduce} onValueChange={toggleReduce} />
          </View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText style={styles.sectionTitle}>{title}</AppText>
      {children}
    </View>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <AppCard style={styles.stat}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
      <AppText style={styles.hint}>{hint}</AppText>
    </AppCard>
  );
}

function TaskRow({ task }: { task: LearningTask }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/(student)/quiz/${task.quizId}` as Href)}>
      <AppCard style={styles.card}>
        <AppText style={styles.cardTitle}>{task.title}</AppText>
        <AppText style={styles.muted}>{task.durationMinutes} min · due {dueText(task.dueAt)}</AppText>
        <AppText style={styles.link}>{task.state === 'IN_PROGRESS' ? 'Continue' : 'Start'}</AppText>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  content: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.xs },
  eyebrow: { color: colors.student, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 21 },
  error: { color: colors.danger },
  statRow: { flexDirection: 'row', gap: spacing.md },
  stat: { alignItems: 'flex-start', flex: 1, gap: 2 },
  statValue: { color: colors.primary, fontSize: 32, fontWeight: '800' },
  statLabel: { fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  card: { gap: spacing.xs },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  link: { color: colors.primary, fontWeight: '800' },
  switchRow: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  switchText: { flex: 1 },
});
