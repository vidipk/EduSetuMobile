import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { AlertCircle, BookOpenCheck, Calendar, ClipboardList, Sun } from 'lucide-react-native';

import { learningApi } from '@/api/academics/learning';
import { studentWorkApi } from '@/api/academics/student-work';
import type { LearningTask } from '@/api/contracts/learning';
import type { StudentHomeworkSummary, StudentQuizSummary } from '@/api/contracts/student-work';
import { useAuth } from '@/auth/AuthProvider';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { daysUntil, formatDate, homeworkStatus, quizStatus, type WorkStatusTone } from '@/app/(student)/work-utils';

import { VSegment, VStrip, VTimelineItem } from './blocks';
import { VEmpty, VError, VHeader, VLoading, VScreen, VSectionHeader } from './components';

type TabKey = 'daily' | 'quizzes' | 'homework';
type BadgeTone = 'amber' | 'mint' | 'blue' | 'danger';

const toneOf = (tone: WorkStatusTone): BadgeTone => (tone === 'danger' ? 'danger' : tone === 'success' ? 'mint' : tone === 'warning' ? 'amber' : 'blue');

export interface TaskRow {
  key: string;
  badge: string;
  tone: BadgeTone;
  tag: string | null;
  title: string;
  meta: string;
  attention: boolean;
  done: boolean;
  href: string | null;
}

const LEARNING_STATE: Record<LearningTask['state'], string> = { PENDING: 'To do', IN_PROGRESS: 'In progress', SUBMITTED: 'Submitted', GRADED: 'Result ready' };

/** Pure mapping so pending/overdue/completed states always mirror what the API returned. */
export function dailyRow(task: LearningTask): TaskRow {
  const finished = task.state === 'SUBMITTED' || task.state === 'GRADED';
  const overdue = task.overdue && !finished;
  return {
    key: `d-${task.assignmentId}`,
    badge: overdue ? 'Overdue' : LEARNING_STATE[task.state],
    tone: overdue ? 'danger' : finished ? 'mint' : 'amber',
    tag: 'Daily quiz',
    title: task.title,
    meta: finished ? (task.state === 'GRADED' ? 'Result ready' : 'Result not released yet') : `Due ${formatDate(task.dueAt)}`,
    attention: overdue,
    done: finished,
    href: task.state === 'PENDING' || task.state === 'IN_PROGRESS' || task.attemptId ? `/(student)/quiz/${task.quizId}` : null,
  };
}

export function quizRow(quiz: StudentQuizSummary): TaskRow {
  const status = quizStatus(quiz);
  const done = status.tone === 'success' || status.label === 'Awaiting review';
  return { key: `q-${quiz.id}`, badge: status.label, tone: toneOf(status.tone), tag: quiz.subject?.name ?? null, title: quiz.title, meta: `${quiz.durationMinutes} min`, attention: false, done, href: `/(student)/quiz/${quiz.id}` };
}

export function homeworkRow(item: StudentHomeworkSummary, now = new Date()): TaskRow {
  const status = homeworkStatus(item, now);
  const remaining = daysUntil(item.dueDate, now);
  const finished = item.submissionStatus !== 'NOT_SUBMITTED';
  return {
    key: `h-${item.id}`,
    badge: status.label,
    tone: toneOf(status.tone),
    tag: item.subject?.name ?? null,
    title: item.title,
    meta: `Due ${formatDate(item.dueDate)}`,
    attention: !finished && remaining !== null && remaining < 0,
    done: finished,
    href: `/(student)/homework/${item.id}`,
  };
}

/** Figma "Tasks V2": segmented switcher, attention strip and a vertical timeline. */
export function VeralayamTasks() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('daily');
  const daily = useRemoteData(user ? `learning-tasks:${user.id}` : null, () => learningApi.tasks());
  const work = useRemoteData(user ? `v-work:${user.id}` : null, async () => {
    const [quizzes, homework] = await Promise.all([studentWorkApi.listQuizzes(), studentWorkApi.listHomework()]);
    return { quizzes, homework };
  });
  const refreshDaily = daily.refresh;
  const refreshWork = work.refresh;
  useFocusEffect(useCallback(() => { if (user) { void refreshDaily(); void refreshWork(); } }, [user, refreshDaily, refreshWork]));

  const rows = useMemo<Record<TabKey, TaskRow[]>>(() => ({
    daily: (daily.data ?? []).map(dailyRow),
    quizzes: (work.data?.quizzes ?? []).map(quizRow),
    homework: (work.data?.homework ?? []).map((item) => homeworkRow(item)),
  }), [daily.data, work.data]);

  const source = tab === 'daily' ? daily : work;
  const list = rows[tab];
  const pending = list.filter((row) => !row.done);
  const completed = list.filter((row) => row.done);
  const attention = pending.filter((row) => row.attention).length;

  return (
    <VScreen onRefresh={() => { void daily.refresh(); void work.refresh(); }} refreshing={source.refreshing}>
      <VHeader eyebrow="My workspace" title="My tasks" subtitle="Small steps. Big progress." />
      <VSegment<TabKey>
        value={tab}
        onChange={setTab}
        options={[
          { id: 'daily', label: 'Daily', count: rows.daily.length, Icon: Sun },
          { id: 'quizzes', label: 'Quizzes', count: rows.quizzes.length, Icon: ClipboardList },
          { id: 'homework', label: 'Homework', count: rows.homework.length, Icon: BookOpenCheck },
        ]}
      />
      {source.loading ? <VLoading label="Loading tasks" /> : null}
      {!source.loading && source.error && !source.data ? <VError message={source.error.message} onRetry={source.reload} /> : null}
      {source.data ? (
        <>
          {attention > 0 ? <VStrip Icon={AlertCircle} tone="amber" text={`${attention} ${attention === 1 ? 'task needs' : 'tasks need'} attention. Overdue work is waiting to be submitted.`} /> : null}
          <View style={{ gap: 12 }}>
            <VSectionHeader title="To take care of" trailing={`${pending.length} pending`} />
            {pending.length === 0 ? <VEmpty title={list.length === 0 ? 'Nothing assigned yet' : 'All caught up'} detail={list.length === 0 ? 'New tasks from your school appear here.' : 'You have no pending tasks in this list.'} /> : null}
            <View>
              {pending.map((row, index) => (
                <VTimelineItem key={row.key} badge={row.badge} badgeTone={row.tone} tag={row.tag} title={row.title} meta={row.meta} MetaIcon={Calendar} last={index === pending.length - 1} onPress={row.href ? () => router.push(row.href as Href) : undefined} />
              ))}
            </View>
          </View>
          {completed.length > 0 ? (
            <View style={{ gap: 12 }}>
              <VSectionHeader title="Recently completed" />
              <View>
                {completed.map((row, index) => (
                  <VTimelineItem key={row.key} done badge={row.badge} badgeTone={row.tone} tag={row.tag} title={row.title} meta={row.meta} last={index === completed.length - 1} onPress={row.href ? () => router.push(row.href as Href) : undefined} />
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </VScreen>
  );
}
