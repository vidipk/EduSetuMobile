import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { BookOpen, Compass, FileText, Feather, Flower2, Lightbulb, PlayCircle, ScrollText, type LucideIcon } from 'lucide-react-native';

import { learningApi } from '@/api/academics/learning';
import { useAuth } from '@/auth/AuthProvider';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { VEmpty, VError, VHeader, VLoading, VResourceTile, VScreen, VSearch, VSectionHeader, VSubjectCard } from '../veralayam-ui/components';
import { filterSubjects, groupSubjects } from './transform';

/** Decorative only: cycled by position, never derived from a subject's name. */
export const SUBJECT_ICONS: LucideIcon[] = [BookOpen, Feather, Flower2, Lightbulb, Compass, ScrollText];

export function chapterCountLabel(count: number) {
  return `${count} ${count === 1 ? 'chapter' : 'chapters'}`;
}

/** Figma "Learn V3": editorial subject library for the institution experience. */
export function VeralayamLearnScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const courses = useRemoteData(user ? `v-catalog:${user.id}` : null, () => learningApi.catalogCourses());
  const subjects = useMemo(() => groupSubjects(courses.data ?? []), [courses.data]);
  const visible = useMemo(() => filterSubjects(subjects, search), [subjects, search]);

  return (
    <VScreen onRefresh={() => void courses.refresh()} refreshing={courses.refreshing}>
      <VHeader eyebrow="The learning library" title="Follow your curiosity." subtitle="Every subject has something to discover." titleSize={30} />
      <VSearch placeholder="Search topics, lessons or notes" value={search} onChangeText={setSearch} />

      <View style={{ gap: 14 }}>
        <VSectionHeader accent title="Choose a subject" trailing={courses.data ? `${String(visible.length).padStart(2, '0')} ${visible.length === 1 ? 'subject' : 'subjects'}` : undefined} />
        {courses.loading ? <VLoading label="Loading subjects" /> : null}
        {!courses.loading && courses.error && !courses.data ? <VError message={courses.error.message} onRetry={courses.reload} /> : null}
        {courses.data && subjects.length === 0 ? <VEmpty Icon={BookOpen} title="No subjects yet" detail="Subjects appear here once your institution publishes learning material." /> : null}
        {courses.data && subjects.length > 0 && visible.length === 0 ? <VEmpty title="Nothing matches your search" detail="Try a different word." /> : null}
        {visible.map((subject, index) => (
          <VSubjectCard
            key={subject.id}
            index={index}
            title={subject.name}
            tagline={subject.description}
            meta={chapterCountLabel(subject.chapters.length)}
            Icon={SUBJECT_ICONS[index % SUBJECT_ICONS.length]}
            onPress={() => router.push({ pathname: '/(student)/learn-subject', params: { subjectId: subject.id } } as unknown as Href)}
          />
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <VSectionHeader title="Learning resources" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <VResourceTile Icon={PlayCircle} tone="mint" title="Videos" subtitle="Watch & learn" onPress={() => router.push('/(student)/learning-videos' as unknown as Href)} />
          <VResourceTile Icon={FileText} tone="violet" title="Notes" subtitle="Not available yet" disabled />
        </View>
      </View>
    </VScreen>
  );
}
