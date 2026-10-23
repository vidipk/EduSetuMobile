import { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { FileText, PlayCircle } from 'lucide-react-native';

import { learningApi } from '@/api/academics/learning';
import type { CourseLessonRecord, LearningCourse } from '@/api/contracts/learning';
import { useAuth } from '@/auth/AuthProvider';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { VEmpty, VError, VHeader, VLoading, VResourceTile, VRowCard, VScreen, VSectionHeader } from '../veralayam-ui/components';
import { param } from './transform';

interface ChapterData {
  title: string;
  description: string | null;
  /** `tracked` lessons come from a published learning course and open the existing lesson screen. */
  lessons: { id: string; title: string; description: string | null; opened: boolean; tracked: boolean }[];
}

export async function loadChapter(courseId: string): Promise<ChapterData | null> {
  const [catalog, learning] = await Promise.all([learningApi.catalogCourses(), learningApi.courses().catch((): LearningCourse[] => [])]);
  const course = catalog.find((item) => item.id === courseId);
  if (!course) return null; // not published / not in this student's class -> same as unknown
  const tracked = learning.find((item) => item.id === courseId);
  if (tracked) {
    return { title: course.title, description: course.description, lessons: tracked.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, description: lesson.description, opened: lesson.opened, tracked: true })) };
  }
  const records: CourseLessonRecord[] = await learningApi.courseLessons(courseId).catch(() => []);
  return {
    title: course.title,
    description: course.description,
    lessons: records.filter((lesson) => !lesson.status || lesson.status === 'PUBLISHED').sort((a, b) => a.orderIndex - b.orderIndex).map((lesson) => ({ id: lesson.id, title: lesson.title, description: lesson.description, opened: false, tracked: false })),
  };
}

export function ChapterDetailScreen() {
  const courseId = param(useLocalSearchParams<{ courseId?: string }>().courseId);
  const { user } = useAuth();
  const chapter = useRemoteData(user && courseId ? `v-chapter:${user.id}:${courseId}` : null, () => loadChapter(courseId as string));
  const data = chapter.data;
  const trackedCount = useMemo(() => data?.lessons.filter((lesson) => lesson.tracked).length ?? 0, [data]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(student)/(tabs)/learn' as Href));

  return (
    <VScreen onRefresh={() => void chapter.refresh()} refreshing={chapter.refreshing}>
      <VHeader onBack={back} eyebrow="Chapter" title={data?.title ?? 'Chapter'} subtitle={data?.description ?? undefined} titleSize={26} />
      {!courseId ? <VEmpty title="Chapter not available" detail="Go back and choose a chapter." /> : null}
      {courseId && chapter.loading ? <VLoading label="Loading chapter" /> : null}
      {courseId && chapter.error && !data ? <VError message={chapter.error.message} onRetry={chapter.reload} /> : null}
      {chapter.data === null && !chapter.loading && !chapter.error ? <VEmpty title="Chapter not available" detail="It may not be part of your class or is no longer published." /> : null}
      {data ? (
        <>
          <View style={{ gap: 12 }}>
            <VSectionHeader accent title="Lessons" trailing={`${data.lessons.length} ${data.lessons.length === 1 ? 'lesson' : 'lessons'}`} />
            {data.lessons.length === 0 ? <VEmpty title="No lessons yet" detail="Lessons appear here once they are published." /> : null}
            {data.lessons.map((lesson, index) => (
              <VRowCard
                key={lesson.id}
                Icon={PlayCircle}
                tone="mint"
                badge={lesson.tracked ? (lesson.opened ? 'Opened' : `Lesson ${index + 1}`) : `Lesson ${index + 1}`}
                title={lesson.title}
                subtitle={lesson.description}
                onPress={lesson.tracked ? () => router.push({ pathname: '/(student)/learning-lesson', params: { courseId, lessonId: lesson.id } } as unknown as Href) : undefined}
              />
            ))}
          </View>
          <View style={{ gap: 12 }}>
            <VSectionHeader title="Learning resources" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <VResourceTile Icon={PlayCircle} tone="mint" title="Lectures" subtitle={trackedCount > 0 ? 'Open a lesson to watch' : 'None linked yet'} disabled />
              <VResourceTile Icon={FileText} tone="violet" title="Reading" subtitle="Not available yet" disabled />
            </View>
          </View>
        </>
      ) : null}
    </VScreen>
  );
}
