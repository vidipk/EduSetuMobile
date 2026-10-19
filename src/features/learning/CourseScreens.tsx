import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';

import { learningApi } from '@/api/academics/learning';
import { AppButton, AppCard, AppScreen, AppText, EmptyState, ErrorState, LoadingState } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { openLecture } from './open-video';

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function LearningCourseScreen() {
  const params = useLocalSearchParams<{ courseId?: string }>();
  const courseId = param(params.courseId);
  const courses = useRemoteData(courseId ? `learning-courses` : null, () => learningApi.courses());
  const course = courses.data?.find((item) => item.id === courseId);

  return (
    <AppScreen style={styles.screen}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}><AppText style={styles.link}>Back</AppText></Pressable>
      {courses.loading ? <LoadingState label="Loading course..." /> : null}
      {courses.error && !courses.data ? <ErrorState message={courses.error.message} /> : null}
      {courses.data && !course ? <EmptyState title="Course not available" detail="It may have been archived or is not part of your class." /> : null}
      {course ? (
        <ScrollView contentContainerStyle={styles.content}>
          <AppText style={styles.title}>{course.title}</AppText>
          {course.description ? <AppText style={styles.muted}>{course.description}</AppText> : null}
          {course.lessons.map((lesson) => (
            <Pressable key={lesson.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(student)/learning-lesson', params: { courseId: course.id, lessonId: lesson.id } } as unknown as Href)}>
              <AppCard style={styles.card}>
                <AppText style={styles.cardTitle}>{lesson.orderIndex}. {lesson.title}</AppText>
                <AppText style={styles.muted}>{lesson.opened ? 'Opened' : 'Not opened yet'}</AppText>
              </AppCard>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </AppScreen>
  );
}

function BulletList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={styles.block}>
      <AppText style={styles.sectionTitle}>{title}</AppText>
      {items.map((item, index) => <AppText key={`${title}-${index}`} style={styles.body}>• {item}</AppText>)}
    </View>
  );
}

export function LearningLessonScreen() {
  const params = useLocalSearchParams<{ courseId?: string; lessonId?: string }>();
  const courseId = param(params.courseId);
  const lessonId = param(params.lessonId);
  const lesson = useRemoteData(courseId && lessonId ? `learning-lesson:${courseId}:${lessonId}` : null, () => learningApi.lesson(courseId as string, lessonId as string));
  const [message, setMessage] = useState<string | null>(null);
  const data = lesson.data;

  return (
    <AppScreen style={styles.screen}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}><AppText style={styles.link}>Back</AppText></Pressable>
      {lesson.loading ? <LoadingState label="Loading lesson..." /> : null}
      {lesson.error && !data ? <ErrorState message={lesson.error.message} /> : null}
      {data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <AppText style={styles.title}>{data.title}</AppText>
          {data.content?.summary ? <AppText style={styles.body}>{data.content.summary}</AppText> : null}
          <BulletList title="Key concepts" items={data.content?.keyConcepts} />
          <BulletList title="Important teachings" items={data.content?.importantTeachings} />
          {data.content?.glossary?.length ? (
            <View style={styles.block}>
              <AppText style={styles.sectionTitle}>Glossary</AppText>
              {data.content.glossary.map((entry) => <AppText key={entry.term} style={styles.body}><AppText style={styles.term}>{entry.term}</AppText> — {entry.meaning}</AppText>)}
            </View>
          ) : null}
          <BulletList title="Reflect" items={data.content?.reflectionPrompts} />
          {data.videos.map((video) => (
            <AppButton
              key={video.id}
              title={`Watch: ${video.title}`}
              onPress={() => void openLecture(video).then((outcome) => setMessage(outcome === 'blocked' || outcome === 'failed' ? 'This lecture could not be opened right now.' : null))}
            />
          ))}
          {message ? <AppText accessibilityRole="alert" style={styles.error}>{message}</AppText> : null}
        </ScrollView>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  title: { fontSize: 26, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 21 },
  body: { lineHeight: 24 },
  block: { gap: spacing.xs },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  term: { fontWeight: '800' },
  card: { gap: spacing.xs },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  link: { color: colors.primary, fontWeight: '800', minHeight: 44, paddingVertical: spacing.sm },
  error: { color: colors.danger },
});
