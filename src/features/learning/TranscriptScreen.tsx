import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { learningApi } from '@/api/academics/learning';
import { useAuth } from '@/auth/AuthProvider';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { useInstitutionExperience } from './experience-store';
import { VCard, VEmpty, VError, VHeader, VLoading, VScreen, VText } from './veralayam-ui/components';
import { vColors } from './veralayam-ui/tokens';

const LANGUAGE_LABELS: Record<string, string> = { en: 'English', hi: 'Hindi', gu: 'Gujarati' };

export function timestampLabel(milliseconds: number | null) {
  if (milliseconds === null || milliseconds < 0) return null;
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function TranscriptScreen() {
  const params = useLocalSearchParams<{ videoId?: string; title?: string; language?: string }>();
  const videoId = typeof params.videoId === 'string' ? params.videoId : '';
  const language = typeof params.language === 'string' ? params.language : undefined;
  const { user } = useAuth();
  const institution = useInstitutionExperience();
  const transcript = useRemoteData(
    institution && user && videoId ? `learning-transcript:${user.id}:${videoId}:${language ?? 'preferred'}` : null,
    () => learningApi.transcript(videoId, language),
  );
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(student)/learning-videos' as Href));

  if (!institution) return <Redirect href={'/(student)/(tabs)/learn' as Href} />;

  return (
    <VScreen onRefresh={() => void transcript.refresh()} refreshing={transcript.refreshing}>
      <VHeader
        bell={false}
        onBack={back}
        eyebrow="Lecture transcript"
        title={transcript.data?.videoTitle ?? (typeof params.title === 'string' ? params.title : 'Transcript')}
        subtitle={transcript.data ? LANGUAGE_LABELS[transcript.data.language] ?? transcript.data.language.toUpperCase() : undefined}
        titleSize={25}
      />
      {!videoId ? <VEmpty title="Transcript not available" detail="Go back and choose a lecture." /> : null}
      {videoId && transcript.loading ? <VLoading label="Loading transcript" /> : null}
      {videoId && transcript.error && !transcript.data ? <VError message={transcript.error.message} onRetry={transcript.reload} /> : null}
      {transcript.data ? (
        <>
          {transcript.data.availableLanguages.length > 1 ? (
            <View style={styles.languages}>
              {transcript.data.availableLanguages.map((code) => {
                const selected = transcript.data?.language === code;
                return (
                  <Pressable
                    key={code}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => router.setParams({ language: code })}
                    style={[styles.language, selected && styles.languageSelected]}
                  >
                    <VText weight="bold" style={selected ? styles.languageTextSelected : styles.languageText}>
                      {LANGUAGE_LABELS[code] ?? code.toUpperCase()}
                    </VText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <VCard style={styles.card}>
            {transcript.data.segments.length > 0 ? transcript.data.segments.map((segment) => {
              const timestamp = timestampLabel(segment.startMs);
              return (
                <View key={`${segment.index}-${segment.startMs ?? 'plain'}`} style={styles.segment}>
                  {timestamp ? <VText weight="bold" style={styles.timestamp}>{timestamp}</VText> : null}
                  <VText style={styles.body} selectable>{segment.text}</VText>
                </View>
              );
            }) : <VText style={styles.body} selectable>{transcript.data.originalText}</VText>}
          </VCard>
        </>
      ) : null}
    </VScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  segment: { gap: 4 },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  language: { alignItems: 'center', borderColor: vColors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  languageSelected: { backgroundColor: vColors.primary, borderColor: vColors.primary },
  languageText: { color: vColors.primary },
  languageTextSelected: { color: vColors.surface },
  timestamp: { color: vColors.primary, fontSize: 12 },
  body: { fontSize: 16, lineHeight: 26 },
});
