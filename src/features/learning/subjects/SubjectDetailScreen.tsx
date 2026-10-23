import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { BookOpen, ClipboardList } from 'lucide-react-native';

import { learningApi } from '@/api/academics/learning';
import { studentWorkApi } from '@/api/academics/student-work';
import { useAuth } from '@/auth/AuthProvider';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { latestQuizAttempt, quizStatus } from '@/app/(student)/work-utils';

import { VEmpty, VError, VHeader, VLoading, VRowCard, VScreen, VSearch, VSectionHeader } from '../veralayam-ui/components';
import { filterChapters, groupSubjects, param } from './transform';

export function SubjectDetailScreen() {
  const subjectId = param(useLocalSearchParams<{ subjectId?: string }>().subjectId);
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const courses = useRemoteData(user && subjectId ? `v-catalog:${user.id}` : null, () => learningApi.catalogCourses());
  // Quizzes are linked to a subject (not to a chapter) by the backend, so they are only offered at this level.
  const quizzes = useRemoteData(user && subjectId ? `v-quizzes:${user.id}` : null, () => studentWorkApi.listQuizzes());
  const subject = useMemo(() => groupSubjects(courses.data ?? []).find((item) => item.id === subjectId), [courses.data, subjectId]);
  const chapters = useMemo(() => filterChapters(subject?.chapters ?? [], search), [subject, search]);
  const subjectQuizzes = (quizzes.data ?? []).filter((quiz) => quiz.subjectId === subjectId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(student)/(tabs)/learn' as Href));

  return (
    <VScreen onRefresh={() => { void courses.refresh(); void quizzes.refresh(); }} refreshing={courses.refreshing}>
      <VHeader onBack={back} eyebrow="Subject" title={subject?.name ?? 'Subject'} subtitle={subject?.description ?? undefined} titleSize={26} />
      {!subjectId ? <VEmpty title="Subject not available" detail="Go back to the library and choose a subject." /> : null}
      {subjectId && courses.loading ? <VLoading label="Loading chapters" /> : null}
      {subjectId && courses.error && !courses.data ? <VError message={courses.error.message} onRetry={courses.reload} /> : null}
      {courses.data && !subject ? <VEmpty title="Subject not available" detail="It may not be part of your class or is no longer published." /> : null}
      {subject ? (
        <>
          {subject.chapters.length > 3 ? <VSearch placeholder="Search chapters" value={search} onChangeText={setSearch} /> : null}
          <View style={{ gap: 12 }}>
            <VSectionHeader accent title="Chapters" trailing={`${chapters.length} ${chapters.length === 1 ? 'chapter' : 'chapters'}`} />
            {chapters.length === 0 ? <VEmpty Icon={BookOpen} title={search ? 'No chapters match' : 'No chapters yet'} detail={search ? 'Try a different word.' : 'Chapters appear here once they are published.'} /> : null}
            {chapters.map((chapter, index) => (
              <VRowCard
                key={chapter.id}
                Icon={BookOpen}
                tone={index % 2 === 0 ? 'mint' : 'blue'}
                badge={`Chapter ${index + 1}`}
                title={chapter.title}
                subtitle={chapter.lessonCount > 0 ? `${chapter.lessonCount} ${chapter.lessonCount === 1 ? 'lesson' : 'lessons'}` : chapter.description}
                onPress={() => router.push({ pathname: '/(student)/learn-chapter', params: { courseId: chapter.id } } as unknown as Href)}
              />
            ))}
          </View>
          {subjectQuizzes.length > 0 ? (
            <View style={{ gap: 12 }}>
              <VSectionHeader title="Practice quizzes" trailing="For this subject" />
              {subjectQuizzes.map((quiz) => {
                const status = quizStatus(quiz);
                const attempt = latestQuizAttempt(quiz);
                return (
                  <VRowCard key={quiz.id} Icon={ClipboardList} tone="amber" badge={status.label} title={quiz.title} subtitle={attempt?.submittedAt ? 'Submitted' : `${quiz.durationMinutes} min`} onPress={() => router.push(`/(student)/quiz/${quiz.id}` as Href)} />
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}
    </VScreen>
  );
}
