import { useMemo } from 'react';
import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { BookOpen, CheckCircle2, ClipboardCheck, LineChart, ListChecks } from 'lucide-react-native';

import { learningApi } from '@/api/academics/learning';
import type { LearningHome } from '@/api/contracts/learning';
import { useAuth } from '@/auth/AuthProvider';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { useLearningExperience } from '../experience-store';
import { MascotBadge } from '../Mascot';
import { openLecture } from '../open-video';
import { groupSubjects } from '../subjects/transform';
import { VFocusCard, VLinkCard, VMetricTile, VStrip } from './blocks';
import { VBell, VError, VLoading, VScreen, VSectionHeader, VText } from './components';
import { vColors } from './tokens';

const percent = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
};

export interface FocusModel {
  title: string;
  detail: string | null;
  actionLabel: string;
  target: { kind: 'quiz'; quizId: string } | { kind: 'lecture' } | { kind: 'learn' };
}

/** Chooses the single next action from real data only: a pending assigned quiz, else the last lecture opened, else the library. */
export function chooseFocus(home: LearningHome): FocusModel {
  const pending = home.pendingToday;
  if (pending.length > 0) {
    const first = pending[0];
    return {
      title: pending.length === 1 ? first.title : `${pending.length} quizzes are waiting for you`,
      detail: pending.length === 1 ? `Due ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(first.dueAt))}` : 'A small step today goes a long way.',
      actionLabel: pending.length === 1 ? 'Start quiz' : 'See my tasks',
      target: pending.length === 1 ? { kind: 'quiz', quizId: first.quizId } : { kind: 'learn' },
    };
  }
  if (home.continueLearning) {
    return { title: home.continueLearning.title, detail: 'Pick up where you left off.', actionLabel: 'Continue learning', target: { kind: 'lecture' } };
  }
  return { title: "You're all caught up", detail: 'Nothing is assigned for today. Explore a subject.', actionLabel: 'Explore subjects', target: { kind: 'learn' } };
}

/** Figma "Home V2" for the institution experience. */
export function VeralayamHome() {
  const { user } = useAuth();
  const home = useRemoteData(user ? `learning-home:${user.id}` : null, () => learningApi.home());
  const catalog = useRemoteData(user ? `v-catalog:${user.id}` : null, () => learningApi.catalogCourses());
  const mascotConfig = useLearningExperience((state) => state.config?.mascot);
  const subjects = useMemo(() => groupSubjects(catalog.data ?? []), [catalog.data]);

  const refresh = () => { void home.refresh(); void catalog.refresh(); };

  if (home.loading) return <VScreen><VLoading label="Loading your learning space" /></VScreen>;
  if (!home.data) return <VScreen><VError message={home.error?.message ?? 'Please try again.'} onRetry={home.reload} /></VScreen>;

  const data = home.data;
  const focus = chooseFocus(data);
  const average = percent(data.quizStatistics.averagePercentage);
  const firstName = data.learner.fullName.split(' ')[0] || 'there';
  const latest = data.recentActivity[0];
  const act = async () => {
    if (focus.target.kind === 'quiz') router.push(`/(student)/quiz/${focus.target.quizId}` as Href);
    else if (focus.target.kind === 'lecture' && data.continueLearning) await openLecture(data.continueLearning);
    else router.push((focus.actionLabel === 'See my tasks' ? '/(student)/(tabs)/tasks' : '/(student)/(tabs)/learn') as Href);
  };

  return (
    <VScreen onRefresh={refresh} refreshing={home.refreshing}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <VText weight="bold" style={{ color: vColors.primary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Your learning space</VText>
          <VText accessibilityRole="header" weight="extrabold" style={{ fontSize: 28, lineHeight: 34 }}>Hi, {firstName}!</VText>
          <VText style={{ color: vColors.muted, fontSize: 14 }}>{data.streak.current > 0 ? `${data.streak.current}-day streak. Keep it going.` : "Let's make today a good day."}</VText>
        </View>
        <VBell />
      </View>

      <VFocusCard chip="Today's focus" title={focus.title} detail={focus.detail} actionLabel={focus.actionLabel} onAction={() => void act()} Icon={ClipboardCheck} art={data.mascot.enabled && mascotConfig?.enabled ? <MascotBadge name={mascotConfig.name} assetKey={mascotConfig.assetKey} state={data.mascot.state} message={data.mascot.message} reduceAnimations={data.mascot.reduceAnimations} /> : undefined} />

      <View style={{ gap: 12 }}>
        <VSectionHeader title="Your progress" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <VMetricTile Icon={LineChart} value={average === null ? '—' : `${average}%`} label="Quiz average" hint={data.quizStatistics.resultsReleased > 0 ? `${data.quizStatistics.resultsReleased} released ${data.quizStatistics.resultsReleased === 1 ? 'result' : 'results'}` : 'Appears once results are released'} />
          <VMetricTile Icon={CheckCircle2} value={String(data.quizStatistics.completed)} label="Quizzes submitted" bar={null} />
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <VSectionHeader title="Keep exploring" />
        <VLinkCard
          Icon={BookOpen}
          title="Your subjects"
          detail={subjects.length > 0 ? subjects.slice(0, 3).map((subject) => subject.name).join(', ') + (subjects.length > 3 ? ` and ${subjects.length - 3} more` : '') : 'Open the library to start learning'}
          onPress={() => router.push('/(student)/(tabs)/learn' as Href)}
        />
        <VLinkCard Icon={ListChecks} title="My progress" detail="Scores, tasks and what to focus on next" onPress={() => router.push('/(student)/performance' as Href)} />
      </View>

      {latest ? <VStrip Icon={CheckCircle2} text={latest.resultReleased ? `${latest.title} result is ready` : `${latest.title} submitted. Result not released yet`} onPress={() => router.push(`/(student)/quiz/${latest.quizId}` as Href)} /> : null}
    </VScreen>
  );
}
