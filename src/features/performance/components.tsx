import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import type { Insight, PerformanceDataNotes, ScoreAggregate, StudentPerformance } from '@/api/contracts/performance';
import { AppButton, AppCard, AppText, LoadingState } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';

import {
  NOT_ENOUGH_DATA,
  evidenceLines,
  marksText,
  monthLabel,
  overdueItems,
  percentText,
  percentValue,
  periodLabel,
  trendText,
  dateLabel,
  type ErrorPresentation,
} from './format';
import { PERIOD_PRESETS, type PeriodPreset } from './period';

// ------------------------------------------------------------------ layout

export function PerformanceScroll({ children, refreshing, onRefresh }: { children: ReactNode; refreshing: boolean; onRefresh: () => void }) {
  return (
    <ScrollView testID="performance-scroll" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
      {children}
    </ScrollView>
  );
}

export function ErrorPanel({ error, onRetry }: { error: ErrorPresentation; onRetry: () => void }) {
  return (
    <AppCard style={styles.errorCard}>
      <AppText accessibilityRole="alert" style={styles.errorText}>{error.message}</AppText>
      {error.sessionExpired ? null : <AppButton title="Retry" onPress={onRetry} />}
    </AppCard>
  );
}

export function LoadingPanel({ label = 'Loading performance...' }: { label?: string }) {
  return <View style={styles.loading}><LoadingState label={label} /></View>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <View accessibilityRole="alert" style={[styles.notice, tone === 'warning' && styles.noticeWarning]}>
      <AppText style={styles.noticeText}>{children}</AppText>
    </View>
  );
}

export function TruncationNotice({ notes }: { notes: PerformanceDataNotes }) {
  if (!notes.truncatedAssessments && !notes.truncatedStudents) return null;
  const parts = [
    notes.truncatedAssessments ? 'only the most recent quizzes and homework were included' : null,
    notes.truncatedStudents ? 'only part of the class was included' : null,
  ].filter(Boolean);
  return <Notice tone="warning">Incomplete data: {parts.join(' and ')}. Figures below may not cover everything in this period.</Notice>;
}

export function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View accessibilityLabel={label} style={styles.chips}>
      {options.map((option) => (
        <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: option.id === value }} accessibilityLabel={`${label}: ${option.label}`} onPress={() => onChange(option.id)} style={[styles.chip, option.id === value && styles.chipActive]}>
          <AppText style={[styles.chipText, option.id === value && styles.chipTextActive]}>{option.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

export function PeriodChips({ value, onChange }: { value: PeriodPreset; onChange: (preset: PeriodPreset) => void }) {
  return <Chips label="Period" options={PERIOD_PRESETS} value={value} onChange={onChange} />;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" style={styles.sectionTitle}>{title}</AppText>
      {children}
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText style={styles.rowLabel}>{label}</AppText>
      <AppText style={styles.rowValue}>{value}</AppText>
    </View>
  );
}

export function Tile({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value === '—' ? NOT_ENOUGH_DATA : value}`} style={styles.tile}>
      <AppText style={styles.tileLabel}>{label}</AppText>
      <AppText style={styles.tileValue}>{value}</AppText>
      {value === '—' ? <AppText style={styles.tileDetail}>{NOT_ENOUGH_DATA}</AppText> : detail ? <AppText style={styles.tileDetail}>{detail}</AppText> : null}
    </View>
  );
}

function scoreDetail(aggregate: ScoreAggregate, noun: string) {
  return aggregate.scoredItems ? (marksText(aggregate) ?? undefined) : `No ${noun} scored yet`;
}

// ---------------------------------------------------------------- insights

export function InsightsBlock({ insights, suggestions }: { insights: Insight[]; suggestions: StudentPerformance['suggestions'] }) {
  const flagged = insights.filter((insight) => insight.status === 'flagged');
  const limited = insights.filter((insight) => insight.status === 'insufficient_data');
  const messageFor = (code: string) => flagged.find((insight) => insight.code === code)?.message;

  return (
    <>
      <Section title="Learning insights">
        <AppText style={styles.muted}>{insights.length === 0 ? 'No areas need attention based on the records available so far.' : 'Based on released scores, graded homework and recorded attendance.'}</AppText>
      </Section>
      {flagged.length ? (
        <Section title="Areas to review">
          {flagged.map((insight, index) => <InsightCard key={`${insight.code}-${insight.subjectId ?? index}`} insight={insight} />)}
        </Section>
      ) : null}
      {limited.length ? (
        <Section title="Not enough data yet">
          {limited.map((insight, index) => <InsightCard key={`${insight.code}-${insight.subjectId ?? index}`} insight={insight} />)}
        </Section>
      ) : null}
      {suggestions.length ? (
        <Section title="Suggested next steps">
          {suggestions.map((suggestion) => (
            <AppCard key={suggestion.code} style={styles.cardGap}>
              <AppText>{suggestion.text}</AppText>
              {messageFor(suggestion.basedOn) ? <AppText style={styles.muted}>Based on: {messageFor(suggestion.basedOn)}</AppText> : null}
            </AppCard>
          ))}
        </Section>
      ) : null}
      <AppText style={styles.footnote}>These insights come from fixed rules applied to school records. They are not AI-generated.</AppText>
    </>
  );
}

export function InsightCard({ insight }: { insight: Insight | { code: string; status: string; message: string; evidence: Insight['evidence']; severity?: string } }) {
  const lines = evidenceLines(insight.evidence);
  const overdue = overdueItems(insight.evidence);
  const attention = insight.status === 'flagged' && insight.severity !== 'info';
  return (
    <AppCard style={styles.cardGap}>
      <AppText style={[styles.badge, attention ? styles.badgeAttention : styles.badgeInfo]}>{insight.status === 'insufficient_data' ? NOT_ENOUGH_DATA : attention ? 'Worth a look' : 'For information'}</AppText>
      <AppText style={styles.insightMessage}>{insight.message}</AppText>
      {lines.length ? (
        <View accessibilityLabel="Supporting evidence" style={styles.evidence}>
          <AppText style={styles.evidenceTitle}>Evidence</AppText>
          {lines.map((line) => <Row key={line.label} label={line.label} value={line.value} />)}
        </View>
      ) : null}
      {overdue.map((item) => <AppText key={item.homeworkId} style={styles.muted}>{item.title} ({item.subjectName}) was due {dateLabel(item.dueDate)}</AppText>)}
    </AppCard>
  );
}

// ------------------------------------------------------------ full report

export function StudentPerformanceView({ data }: { data: StudentPerformance }) {
  const { quizzes, homework, attendance, overall, subjects, trend } = data;
  const noData = overall.scoredItems === 0 && quizzes.assigned === 0 && homework.assigned === 0 && attendance.totalSessions === 0;

  return (
    <>
      <View style={styles.header}>
        <AppText style={styles.title}>{data.student.name}</AppText>
        <AppText style={styles.muted}>{data.student.class.name} {data.student.section.name} · {data.student.academicYear.name}</AppText>
        <AppText style={styles.muted}>{periodLabel(data.period)}</AppText>
        {data.scope.assignedSubjectsOnly ? <AppText style={styles.muted}>Showing only the subjects you teach.</AppText> : null}
      </View>
      <TruncationNotice notes={data.dataNotes} />
      {noData ? <Notice>No quizzes, homework or attendance have been recorded for this period.</Notice> : null}

      <View style={styles.tiles}>
        <Tile label="Overall score" value={percentValue(overall.weightedPercentage)} detail={scoreDetail(overall, 'work')} />
        <Tile label="Quiz average" value={percentValue(quizzes.weightedPercentage)} detail={scoreDetail(quizzes, 'quizzes')} />
        <Tile label="Homework average" value={percentValue(homework.weightedPercentage)} detail={scoreDetail(homework, 'homework')} />
        <Tile label="Attendance" value={percentValue(attendance.percentage)} detail={attendance.totalSessions ? `${attendance.present} of ${attendance.totalSessions} sessions present` : null} />
      </View>
      <AppText style={styles.footnote}>Scores include only released quiz results and graded homework. Work awaiting review is not counted as zero.</AppText>

      <Section title="Quizzes">
        <AppCard style={styles.cardGap}>
          <Row label="Assigned" value={String(quizzes.assigned)} />
          <Row label="Submitted" value={String(quizzes.submitted)} />
          <Row label="Awaiting results" value={String(quizzes.pendingReview)} />
          <Row label="Results released" value={String(quizzes.released)} />
          <Row label="Submission rate" value={percentText(quizzes.submissionRate)} />
        </AppCard>
      </Section>

      <Section title="Homework">
        <AppCard style={styles.cardGap}>
          <Row label="Assigned" value={String(homework.assigned)} />
          <Row label="Submitted" value={String(homework.submitted)} />
          <Row label="Submitted late" value={String(homework.late)} />
          <Row label="Awaiting grading" value={String(homework.pendingReview)} />
          <Row label="Graded" value={String(homework.graded)} />
          <Row label="Past due, not submitted" value={String(homework.overdueNotSubmitted)} />
          <Row label="Completion rate" value={percentText(homework.completionRate)} />
        </AppCard>
      </Section>

      <Section title="Attendance">
        <AppCard style={styles.cardGap}>
          {attendance.status === 'no_data' ? <AppText style={styles.muted}>{NOT_ENOUGH_DATA}: no attendance sessions were recorded in this period.</AppText> : (
            <>
              <Row label="Sessions recorded" value={String(attendance.totalSessions)} />
              <Row label="Present" value={String(attendance.present)} />
              <Row label="Absent" value={String(attendance.absent)} />
              {(attendance.monthly ?? []).map((month) => <Row key={month.month} label={monthLabel(month.month)} value={`${percentValue(month.percentage)} (${month.present}/${month.present + month.absent})`} />)}
            </>
          )}
        </AppCard>
      </Section>

      <Section title="Subjects">
        {subjects.length === 0 ? <AppText style={styles.muted}>{NOT_ENOUGH_DATA}: no scored work in any subject yet.</AppText> : subjects.map((subject) => (
          <AppCard key={subject.subjectId} style={styles.cardGap}>
            <View style={styles.row}>
              <AppText style={styles.subjectName}>{subject.subjectName}</AppText>
              <AppText accessibilityLabel={`${subject.subjectName} score ${percentText(subject.combined.weightedPercentage)}`} style={styles.rowValue}>{percentValue(subject.combined.weightedPercentage)}</AppText>
            </View>
            <ProgressBar value={subject.combined.weightedPercentage} />
            <AppText style={styles.muted}>{marksText(subject.combined) ?? NOT_ENOUGH_DATA}</AppText>
            {subject.status === 'limited' ? <AppText style={styles.muted}>Based on only a few results so far.</AppText> : null}
          </AppCard>
        ))}
      </Section>

      <Section title="Progress over time">
        <AppCard style={styles.cardGap}>
          <AppText>{trendText(trend.direction)}</AppText>
          {trend.direction !== 'insufficient_data' && trend.earlierPercentage !== null && trend.recentPercentage !== null ? <AppText style={styles.muted}>Earlier {percentText(trend.earlierPercentage)} → recent {percentText(trend.recentPercentage)}</AppText> : null}
          {trend.monthly.map((point) => (
            <View key={point.month} style={styles.trendRow}>
              <AppText style={styles.rowLabel}>{monthLabel(point.month)}</AppText>
              <View style={styles.trendBar}><ProgressBar value={point.weightedPercentage} /></View>
              <AppText style={styles.trendValue}>{percentValue(point.weightedPercentage)}</AppText>
            </View>
          ))}
        </AppCard>
      </Section>

      <InsightsBlock insights={data.insights} suggestions={data.suggestions} />
    </>
  );
}

export function ProgressBar({ value }: { value: number | null }) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.barTrack}>
      {value === null ? null : <View style={[styles.barFill, { width: `${width}%` }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  loading: { minHeight: 240 },
  header: { gap: spacing.xs },
  title: { fontSize: 24, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 20 },
  footnote: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  cardGap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  rowLabel: { color: colors.muted, flexShrink: 1 },
  rowValue: { fontWeight: '700', textAlign: 'right' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexGrow: 1, flexBasis: '45%', gap: spacing.xs, minWidth: 140, padding: spacing.md },
  tileLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tileValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
  tileDetail: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  notice: { backgroundColor: '#EAF2F1', borderRadius: radius.md, padding: spacing.md },
  noticeWarning: { backgroundColor: colors.accent },
  noticeText: { fontSize: 14, lineHeight: 20 },
  errorCard: { gap: spacing.md },
  errorText: { color: colors.danger, lineHeight: 22 },
  subjectName: { flexShrink: 1, fontSize: 16, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', borderRadius: radius.sm, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeAttention: { backgroundColor: colors.accent, color: '#5B4300' },
  badgeInfo: { backgroundColor: '#E6ECEB', color: colors.text },
  insightMessage: { fontWeight: '600', lineHeight: 22 },
  evidence: { borderColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm },
  evidenceTitle: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  barTrack: { backgroundColor: '#E6ECEB', borderRadius: radius.sm, height: 8, overflow: 'hidden' },
  barFill: { backgroundColor: colors.primary, height: 8 },
  trendRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  trendBar: { flex: 1 },
  trendValue: { fontWeight: '700', minWidth: 56, textAlign: 'right' },
});
