import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';

import { learningApi } from '@/api/academics/learning';
import type { LearningCourse, LearningVideo, VideoCatalogue } from '@/api/contracts/learning';
import { normalizeApiError } from '@/api/client/error';
import { AppButton, AppCard, AppScreen, AppText, EmptyState, ErrorState, LoadingState, SearchInput } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';
import { useAuth } from '@/auth/AuthProvider';

import { openLecture } from './open-video';

const LANGUAGES = [
  { id: '', label: 'All languages' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'en', label: 'English' },
  { id: 'gu', label: 'ગુજરાતી' },
];

export function durationLabel(seconds: number | null) {
  if (seconds === null || seconds < 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

interface CatalogueState {
  items: LearningVideo[];
  topics: VideoCatalogue['topics'];
  page: number;
  totalPages: number;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
}

export function LearnScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [topicId, setTopicId] = useState('');
  const [language, setLanguage] = useState('');
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [openMessage, setOpenMessage] = useState<string | null>(null);
  const [state, setState] = useState<CatalogueState>({ items: [], topics: [], page: 1, totalPages: 1, loading: true, loadingMore: false, refreshing: false, error: null });
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (page: number, mode: 'replace' | 'more' | 'refresh') => {
    const request = ++requestRef.current;
    setState((current) => ({ ...current, loading: mode === 'replace', loadingMore: mode === 'more', refreshing: mode === 'refresh', error: null }));
    try {
      const result = await learningApi.catalogue({ page, limit: 12, search: query, topicId, language });
      if (request !== requestRef.current) return; // a newer filter superseded this response
      setState((current) => ({
        items: mode === 'more' ? [...current.items, ...result.items] : result.items,
        topics: result.topics,
        page: result.meta.page,
        totalPages: result.meta.totalPages,
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: null,
      }));
    } catch (error) {
      if (request !== requestRef.current) return;
      setState((current) => ({ ...current, loading: false, loadingMore: false, refreshing: false, error: normalizeApiError(error).message }));
    }
  }, [query, topicId, language]);

  useEffect(() => { void load(1, 'replace'); }, [load]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void learningApi.courses().then((result) => { if (active) setCourses(result); }).catch(() => undefined);
    return () => { active = false; };
  }, [user]);

  const open = async (video: LearningVideo) => {
    const outcome = await openLecture(video);
    setOpenMessage(outcome === 'blocked' || outcome === 'failed' ? 'This lecture could not be opened right now.' : null);
  };

  return (
    <AppScreen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void load(1, 'refresh')} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <AppText style={styles.eyebrow}>Lectures and courses</AppText>
          <AppText style={styles.title}>Learn</AppText>
        </View>

        <SearchInput placeholder="Search lectures" value={search} onChangeText={setSearch} returnKeyType="search" />
        <Chips options={LANGUAGES} value={language} onChange={setLanguage} />
        {state.topics.length > 0 ? <Chips options={[{ id: '', label: 'All topics' }, ...state.topics.map((topic) => ({ id: topic.id, label: topic.name }))]} value={topicId} onChange={setTopicId} /> : null}

        {courses.length > 0 ? (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Courses</AppText>
            {courses.map((course) => (
              <Pressable key={course.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(student)/learning-course', params: { courseId: course.id } } as unknown as Href)}>
                <AppCard style={styles.courseCard}>
                  <AppText style={styles.cardTitle}>{course.title}</AppText>
                  {course.description ? <AppText style={styles.muted} numberOfLines={2}>{course.description}</AppText> : null}
                  <AppText style={styles.muted}>{course.lessonsOpened} of {course.lessons.length} lessons opened</AppText>
                </AppCard>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Lectures</AppText>
          {state.loading ? <LoadingState label="Loading lectures..." /> : null}
          {!state.loading && state.error ? <View style={styles.stateWrap}><ErrorState message={state.error} /><AppButton title="Try again" onPress={() => void load(1, 'replace')} /></View> : null}
          {!state.loading && !state.error && state.items.length === 0 ? (
            <EmptyState title="No lectures found" detail={query || topicId || language ? 'Try clearing the search or filters.' : 'Approved lectures will appear here.'} />
          ) : null}
          {state.items.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onOpen={() => void open(video)}
              onTranscript={video.transcriptLanguages?.length
                ? () => router.push({ pathname: '/(student)/learning-transcript', params: { videoId: video.id, title: video.title } } as unknown as Href)
                : undefined}
            />
          ))}
          {openMessage ? <AppText accessibilityRole="alert" style={styles.error}>{openMessage}</AppText> : null}
          {state.page < state.totalPages ? <AppButton title="Load more" loading={state.loadingMore} onPress={() => void load(state.page + 1, 'more')} /> : null}
        </View>

        <AppButton title="AI study help" onPress={() => router.push('/(student)/ai' as unknown as Href)} />
      </ScrollView>
    </AppScreen>
  );
}

function VideoCard({ video, onOpen, onTranscript }: { video: LearningVideo; onOpen: () => void; onTranscript?: () => void }) {
  const duration = durationLabel(video.durationSeconds);
  return (
    <AppCard style={styles.videoCard}>
        {video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} contentFit="cover" accessibilityIgnoresInvertColors /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
        <AppText style={styles.cardTitle}>{video.title}</AppText>
        <AppText style={styles.muted}>
          {[video.topic?.name, duration, video.language?.toUpperCase()].filter(Boolean).join(' · ')}
        </AppText>
      <View style={styles.videoActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${video.title} on YouTube`} onPress={onOpen} style={styles.videoAction}>
          <AppText style={styles.link}>Watch on YouTube</AppText>
        </Pressable>
        {onTranscript ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Read transcript for ${video.title}`} onPress={onTranscript} style={styles.videoAction}>
            <AppText style={styles.link}>Read transcript</AppText>
          </Pressable>
        ) : null}
      </View>
    </AppCard>
  );
}

function Chips({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable key={option.id || 'all'} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(option.id)} style={[styles.chip, selected && styles.chipActive]}>
            <AppText style={[styles.chipText, selected && styles.chipTextActive]}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  header: { gap: spacing.xs },
  eyebrow: { color: colors.student, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  stateWrap: { gap: spacing.md },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 999, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.lg },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  courseCard: { gap: spacing.xs },
  videoCard: { gap: spacing.xs },
  videoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  videoAction: { justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  thumb: { aspectRatio: 16 / 9, backgroundColor: colors.border, borderRadius: radius.md, width: '100%' },
  thumbEmpty: { opacity: 0.6 },
  cardTitle: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  muted: { color: colors.muted, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: '800' },
  error: { color: colors.danger },
});
