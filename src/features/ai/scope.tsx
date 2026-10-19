import { useState } from 'react';
import { View } from 'react-native';

import { studentAiApi } from '@/api/academics/ai-learning';
import type { ChapterOption, StudentSubject } from '@/api/contracts/ai-learning';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/design-system/components';
import { Chips, ErrorPanel } from '@/features/performance/components';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { SkeletonList } from '@/features/teacher-ops/ui';

/**
 * Subject and chapter selection from the student's own, server-authorized data. Nothing here is
 * trusted by the backend: it re-validates the subject and chapter on every AI request.
 */
export function useStudentScope() {
  const { user } = useAuth();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const dashboard = useRemoteData(user ? `ai-dashboard:${user.id}` : null, () => studentAiApi.dashboard());
  const subjects: StudentSubject[] = dashboard.data?.subjects ?? [];
  const subject = subjects.find((entry) => entry.id === subjectId) ?? null;
  const chapters = useRemoteData(user && subject ? `ai-chapters:${user.id}:${subject.id}` : null, () => studentAiApi.chapters((subject as StudentSubject).id));
  const chapterList: ChapterOption[] = chapters.data ?? [];
  const chapter = chapterList.find((entry) => entry.id === chapterId) ?? null;

  return {
    dashboard,
    chapters,
    subjects,
    subject,
    chapterList,
    chapter,
    selectSubject: (id: string) => { setSubjectId(id); setChapterId(null); },
    selectChapter: (id: string) => setChapterId(id),
    profile: dashboard.data?.profile ?? null,
  };
}

export type StudentScope = ReturnType<typeof useStudentScope>;

export function ScopePicker({ scope, disabled }: { scope: StudentScope; disabled?: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      {scope.dashboard.loading ? <SkeletonList rows={1} /> : null}
      {scope.dashboard.error ? <ErrorPanel error={scope.dashboard.error} onRetry={scope.dashboard.reload} /> : null}
      {scope.dashboard.data && scope.subjects.length === 0 ? <AppText>No subjects are assigned to your class yet.</AppText> : null}
      {scope.subjects.length ? (
        <Chips label="Subject" options={scope.subjects.map((entry) => ({ id: entry.id, label: entry.name }))} value={scope.subject?.id ?? ''} onChange={(id) => { if (!disabled) scope.selectSubject(id); }} />
      ) : null}
      {scope.subject && scope.chapters.loading ? <SkeletonList rows={1} /> : null}
      {scope.chapters.error ? <ErrorPanel error={scope.chapters.error} onRetry={scope.chapters.reload} /> : null}
      {scope.subject && scope.chapters.data && scope.chapterList.length === 0 ? <AppText>Your teacher has not published chapters for this subject yet.</AppText> : null}
      {scope.chapterList.length ? (
        <Chips label="Chapter" options={scope.chapterList.map((entry) => ({ id: entry.id, label: entry.title }))} value={scope.chapter?.id ?? ''} onChange={(id) => { if (!disabled) scope.selectChapter(id); }} />
      ) : null}
    </View>
  );
}
