import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { AlertCircle, BookOpen, CalendarCheck, ClipboardList, ChevronRight, Info, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react-native';

import { performanceApi } from '@/api/academics/performance';
import type { Insight, StudentPerformance, Suggestion } from '@/api/contracts/performance';
import { useAuth } from '@/auth/AuthProvider';
import { presetRange } from '@/features/performance/period';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { VMetricTile, VStrip } from './blocks';
import { VCard, VEmpty, VError, VHeader, VLoading, VPill, VRowCard, VScreen, VSectionHeader, VText } from './components';
import { vColors, vRadius, vShadow } from './tokens';

const pct = (value: number | null | undefined) => (value === null || value === undefined ? null : `${Math.round(value * 100) / 100}%`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One shared fetch per screen, using the existing rules-based /students/me/performance contract (no AI, no invented values). */
function useMyPerformance() {
  const { user } = useAuth();
  return useRemoteData(user ? `v-perf:${user.id}` : null, () => performanceApi.getMyPerformance({ ...presetRange('academic-year') }));
}

const go = (href: string) => router.push(href as Href);
const back = () => (router.canGoBack() ? router.back() : router.replace('/(student)/(tabs)' as Href));

function Shell({ result, children, onBack, eyebrow, title, subtitle, titleSize }: {
  result: ReturnType<typeof useMyPerformance>; children: (data: StudentPerformance) => React.ReactNode; onBack?: () => void; eyebrow: string; title: string; subtitle: string; titleSize?: number;
}) {
  return (
    <VScreen onRefresh={() => void result.refresh()} refreshing={result.refreshing}>
      <VHeader onBack={onBack} eyebrow={eyebrow} title={title} subtitle={subtitle} titleSize={titleSize} />
      {result.loading ? <VLoading label="Loading your progress" /> : null}
      {!result.loading && result.error && !result.data ? <VError message={result.error.message} onRetry={result.reload} /> : null}
      {result.data ? children(result.data) : null}
    </VScreen>
  );
}

/** Figma "Performance V2": progress journal. */
export function VeralayamPerformance() {
  const result = useMyPerformance();
  return (
    <Shell result={result} onBack={back} eyebrow="Your progress journal" title="See how you're growing." subtitle="Your learning, in one clear view." titleSize={26}>
      {(data) => {
        const average = pct(data.quizzes.weightedPercentage);
        const flagged = data.insights.find((insight) => insight.status === 'flagged');
        return (
          <>
            <View style={styles.hero}>
              <VText weight="bold" style={styles.heroLabel}>Overall quiz average</VText>
              <VText weight="extrabold" style={styles.heroValue} adjustsFontSizeToFit numberOfLines={1}>{average ?? '—'}</VText>
              <VText style={styles.heroSub}>{data.quizzes.scoredItems > 0 ? `Based on ${plural(data.quizzes.scoredItems, 'released quiz result', 'released quiz results')}` : 'Appears once quiz results are released'}</VText>
              {data.quizzes.weightedPercentage !== null ? <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, data.quizzes.weightedPercentage))}%` }]} /></View> : null}
              {data.quizzes.weightedPercentage !== null ? <VText weight="semibold" style={styles.heroNote}>Keep going — every lesson counts.</VText> : null}
            </View>
            <View style={{ gap: 12 }}>
              <VSectionHeader title="At a glance" />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <VMetricTile Icon={ClipboardList} value={`${data.quizzes.submitted} of ${data.quizzes.assigned}`} label="Quizzes submitted" />
                <VMetricTile Icon={AlertCircle} value={String(data.homework.overdueNotSubmitted)} label="Homework overdue" />
              </View>
            </View>
            <View style={{ gap: 12 }}>
              <VSectionHeader title="Where to focus next" />
              {flagged ? <VRowCard Icon={AlertCircle} tone="amber" title={flagged.subjectName ? `${flagged.subjectName}: ${flagged.message}` : flagged.message} onPress={() => go('/(student)/learning-insights')} /> : <VEmpty title="Nothing flagged" detail="When something needs attention it will appear here, based on released results." />}
              <VRowCard Icon={BookOpen} tone="mint" title="Academic details" subtitle="Subjects, homework and attendance" onPress={() => go('/(student)/academic-details')} />
              <VRowCard Icon={TrendingUp} tone="blue" title="My improvement plan" subtitle="Helpful next steps, one at a time" onPress={() => go('/(student)/improvement-plan')} />
            </View>
          </>
        );
      }}
    </Shell>
  );
}

/** Figma "Academic Details": real homework, attendance and per-subject results. */
export function VeralayamAcademicDetails() {
  const result = useMyPerformance();
  return (
    <Shell result={result} onBack={back} eyebrow="Your academic record" title="Academic details" subtitle="A closer look at your school progress.">
      {(data) => (
        <>
          <VCard style={styles.pillRow}>
            <VText weight="bold" style={{ fontSize: 14 }}>{data.student.academicYear.name}</VText>
            <VText style={{ color: vColors.muted, fontSize: 13 }}>{data.scope.subjectId ? 'One subject' : 'All subjects'}</VText>
          </VCard>
          <View style={{ gap: 12 }}>
            <VSectionHeader title="Homework progress" />
            <VCard style={{ gap: 8 }}>
              <VText weight="extrabold" style={{ fontSize: 22 }}>{data.homework.submitted} of {data.homework.assigned} submitted</VText>
              <VText style={{ color: vColors.muted, fontSize: 13 }}>{data.homework.overdueNotSubmitted} past due · {data.homework.pendingReview} awaiting grading</VText>
              <View style={styles.trackLight}><View style={[styles.fill, { width: `${data.homework.assigned > 0 ? Math.min(100, (data.homework.submitted / data.homework.assigned) * 100) : 0}%` }]} /></View>
            </VCard>
            <VRowCard Icon={CalendarCheck} tone="mint" title="Attendance" subtitle={data.attendance.status === 'no_data' || data.attendance.percentage === null ? 'No sessions recorded for this period' : `${pct(data.attendance.percentage)} · ${data.attendance.present} of ${data.attendance.totalSessions} sessions`} />
          </View>
          <View style={{ gap: 12 }}>
            <VSectionHeader title="By subject" trailing="Released results" />
            {data.subjects.length === 0 ? <VEmpty title="No subject results yet" detail="Results appear here once they are released." /> : null}
            {data.subjects.map((subject) => {
              const value = subject.combined.weightedPercentage;
              const items = subject.combined.scoredItems;
              return (
                <VCard key={subject.subjectId} style={{ gap: 8 }}>
                  <View style={styles.between}>
                    <VText weight="bold" numberOfLines={2} style={{ flex: 1, fontSize: 16 }}>{subject.subjectName}</VText>
                    <VText weight="extrabold" style={{ fontSize: 16 }}>{pct(value) ?? '—'}</VText>
                  </View>
                  <View style={styles.trackLight}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value ?? 0))}%` }]} /></View>
                  <VText style={{ color: vColors.muted, fontSize: 12 }}>{items === 0 ? 'No released results yet' : subject.status === 'limited' ? `${plural(items, 'result', 'results')} · not enough for a trend` : plural(items, 'released result', 'released results')}</VText>
                </VCard>
              );
            })}
          </View>
          {data.trend.direction !== 'insufficient_data' && data.trend.earlierPercentage !== null && data.trend.recentPercentage !== null ? (
            <View style={{ gap: 12 }}>
              <VSectionHeader title="Scores over time" />
              <Pressable accessibilityRole="button" onPress={() => go('/(student)/learning-insights')} style={styles.linkRow}>
                <View style={{ flex: 1 }}>
                  <VText weight="bold">Earlier {pct(data.trend.earlierPercentage)} → Recent {pct(data.trend.recentPercentage)}</VText>
                  <VText weight="semibold" style={{ color: vColors.primary, fontSize: 12 }}>See learning insights</VText>
                </View>
                <ChevronRight color={vColors.primary} size={20} />
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </Shell>
  );
}

function InsightCard({ insight, data }: { insight: Insight; data: StudentPerformance }) {
  const [open, setOpen] = useState(false);
  const limited = insight.status === 'insufficient_data';
  const declining = insight.code === 'DECLINING_PERFORMANCE' && !limited;
  return (
    <VCard style={{ gap: 10 }}>
      <VPill label={limited ? 'More results needed' : declining ? 'Recent change' : insight.severity === 'attention' ? 'Worth a look' : 'For information'} tone={limited ? 'blue' : 'amber'} />
      <VText weight="extrabold" style={{ fontSize: 19, lineHeight: 26 }}>{insight.subjectName ? `${insight.subjectName}: ` : ''}{insight.message}</VText>
      {declining && data.trend.earlierPercentage !== null && data.trend.recentPercentage !== null ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[styles.stat, { backgroundColor: vColors.mintSoft }]}><VText style={styles.statLabel}>Earlier average</VText><VText weight="extrabold" style={{ fontSize: 24 }}>{pct(data.trend.earlierPercentage)}</VText></View>
          <View style={[styles.stat, { backgroundColor: vColors.amberSoft }]}><VText style={styles.statLabel}>Recent average</VText><VText weight="extrabold" style={{ fontSize: 24 }}>{pct(data.trend.recentPercentage)}</VText></View>
        </View>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.between}>
        <VText weight="bold" style={{ color: vColors.primary, fontSize: 13 }}>How was this calculated?</VText>
        <ChevronRight color={vColors.primary} size={18} />
      </Pressable>
      {open ? <VText style={{ color: vColors.muted, fontSize: 12, lineHeight: 18 }}>{`${data.dataNotes.scoredEvidence} ${data.dataNotes.percentages}`}</VText> : null}
    </VCard>
  );
}

/** Figma "Learning Insights": the backend's rules-based insights only. */
export function VeralayamInsights() {
  const result = useMyPerformance();
  return (
    <Shell result={result} onBack={back} eyebrow="A closer look" title="Learning insights" subtitle="Understand what your results are showing.">
      {(data) => (
        <>
          <VStrip Icon={ShieldCheck} text="Based on released grades and homework" />
          <View style={{ gap: 12 }}>
            <VSectionHeader title="Worth a look" />
            {data.insights.length === 0 ? <VEmpty title="Nothing to flag" detail="There is not enough released work to show insights yet." /> : null}
            {data.insights.map((insight, index) => <InsightCard key={`${insight.code}-${insight.subjectId ?? index}`} insight={insight} data={data} />)}
          </View>
          <VRowCard Icon={TrendingDown} tone="blue" title="See my improvement plan" subtitle="Turn these insights into small actions" onPress={() => go('/(student)/improvement-plan')} />
        </>
      )}
    </Shell>
  );
}

const ACTION: Record<Suggestion['basedOn'], { label: string; href: string; Icon: typeof BookOpen }> = {
  LOW_SUBJECT_SCORE: { label: 'Open learning resources', href: '/(student)/(tabs)/learn', Icon: BookOpen },
  DECLINING_PERFORMANCE: { label: 'Open learning resources', href: '/(student)/(tabs)/learn', Icon: BookOpen },
  OVERDUE_HOMEWORK: { label: 'View your homework', href: '/(student)/(tabs)/tasks', Icon: ClipboardList },
  LOW_ATTENDANCE: { label: 'See academic details', href: '/(student)/academic-details', Icon: CalendarCheck },
};

/** Figma "Improvement Plan": only the suggestions the backend rules produced, each linked to a real screen. */
export function VeralayamImprovementPlan() {
  const { user } = useAuth();
  const result = useMyPerformance();
  const first = user?.fullName.split(' ')[0] ?? '';
  return (
    <Shell result={result} onBack={back} eyebrow="Your learning path" title="My improvement plan" subtitle="Helpful next steps, one at a time.">
      {(data) => (
        <>
          <View style={styles.encourage}>
            <VText weight="bold" style={{ color: vColors.primary, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>A little progress each day</VText>
            <VText weight="extrabold" style={{ fontSize: 22 }}>{first ? `You've got this, ${first}.` : "You've got this."}</VText>
            <VText style={{ color: vColors.body, fontSize: 13 }}>Choose one thing to work on today.</VText>
          </View>
          <View style={{ gap: 12 }}>
            <VSectionHeader title="Your next steps" trailing={`${data.suggestions.length} suggested`} />
            {data.suggestions.length === 0 ? <VEmpty title="No suggestions right now" detail="Suggestions appear when released results or homework show something to work on." /> : null}
            {data.suggestions.map((suggestion, index) => {
              const action = ACTION[suggestion.basedOn];
              return (
                <VRowCard key={`${suggestion.code}-${index}`} Icon={action.Icon} tone={index % 2 === 0 ? 'blue' : 'amber'} badge={`Step ${index + 1}`} title={suggestion.text} subtitle={action.label} onPress={() => go(action.href)} />
              );
            })}
          </View>
          <VStrip Icon={Info} text="These steps are based on released quiz scores and recorded homework submission status." />
        </>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: vColors.mint, borderRadius: 24, gap: 6, overflow: 'hidden', padding: 20 },
  heroLabel: { color: vColors.primary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  heroValue: { fontSize: 56, lineHeight: 64 },
  heroSub: { color: vColors.body, fontSize: 13 },
  heroNote: { color: vColors.primary, fontSize: 13, marginTop: 4 },
  track: { backgroundColor: '#C8DFD7', borderRadius: 4, height: 8, marginTop: 6, overflow: 'hidden' },
  trackLight: { backgroundColor: vColors.border, borderRadius: 4, height: 8, overflow: 'hidden' },
  fill: { backgroundColor: vColors.primary, borderRadius: 4, height: 8 },
  pillRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', padding: 14 },
  between: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  linkRow: { alignItems: 'center', backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.card, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 16, ...vShadow },
  stat: { borderRadius: 14, flex: 1, gap: 2, padding: 12 },
  statLabel: { color: vColors.muted, fontSize: 11 },
  encourage: { backgroundColor: vColors.mint, borderRadius: 24, gap: 6, padding: 20 },
});
