import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { studentAiApi } from '@/api/academics/ai-learning';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppScreen, AppText } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { ErrorPanel, Notice } from '@/features/performance/components';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { FormScroll, SkeletonList } from '@/features/teacher-ops/ui';

interface Tile {
  title: string;
  body: string;
  href: Href;
  /** Null when the feature is available; otherwise the backend-provided reason. */
  disabledReason: string | null;
}

/** Learning hub. Availability always comes from the backend capability checks and school settings. */
export default function AiHubScreen() {
  const { user } = useAuth();
  const dashboard = useRemoteData(user ? `ai-hub-dashboard:${user.id}` : null, () => studentAiApi.dashboard());
  const revision = useRemoteData(user ? `ai-rev-config:${user.id}` : null, () => studentAiApi.revisionConfig());

  const features = dashboard.data?.featureAvailability;
  const off = features && !features.studentAiEnabled ? 'AI learning is turned off for students by your school.' : null;
  const voiceDoubtReason = off ?? (features && !(features.voiceAvailable && features.voiceDoubtAssistantEnabled) ? (features.voiceDisabledReason ?? 'Voice is not available right now.') : null);
  const notEnabled = (flag: boolean | undefined, label: string) => (flag === false ? `${label} is not enabled by your school.` : null);
  const revText = revision.data?.capabilities.text;
  const revVoice = revision.data?.capabilities.voice;

  const tiles: Tile[] = [
    { title: 'Ask AI (chat)', body: 'Ask a doubt about a chapter and get an answer from your school material.', href: '/ai/doubt-chat', disabledReason: off ?? notEnabled(features?.textDoubtEnabled, 'Ask AI chat') },
    { title: 'Ask AI (voice)', body: 'Talk through a doubt with a live AI tutor.', href: '/ai/doubt-voice', disabledReason: voiceDoubtReason },
    { title: 'Revision (chat)', body: 'Guided revision of selected chapters, step by step.', href: '/ai/revision-chat', disabledReason: off ?? (revText && !revText.available ? revText.disabledReason ?? 'Text revision is unavailable.' : null) },
    { title: 'Revision (voice)', body: 'Spoken revision with recap, key points and quick questions.', href: '/ai/revision-voice', disabledReason: off ?? (revVoice && !revVoice.available ? revVoice.disabledReason ?? 'Voice revision is unavailable.' : null) },
    { title: 'Practice questions', body: 'Practice only. Never graded and never added to your marks.', href: '/ai/practice', disabledReason: off ?? notEnabled(features?.practiceQuestionsEnabled, 'Practice questions') },
    { title: 'Flashcards', body: 'Flip cards to revise key ideas from a chapter.', href: '/ai/flashcards', disabledReason: off ?? notEnabled(features?.flashcardsEnabled, 'Flashcards') },
  ];

  return (
    <AppScreen style={{ padding: 0 }}>
      <FormScroll>
        <AppText accessibilityRole="header" style={{ fontSize: 24, fontWeight: '800' }}>Learn with AI</AppText>
        <AppText style={{ color: colors.muted }}>Your tutor uses material your school has published.</AppText>
        {dashboard.loading ? <SkeletonList rows={2} /> : null}
        {dashboard.error ? <ErrorPanel error={dashboard.error} onRetry={dashboard.reload} /> : null}
        {off ? <Notice tone="warning">{off}</Notice> : null}
        <View style={{ gap: spacing.md }}>
          {tiles.map((tile) => (
            <AppCard key={tile.title} style={{ gap: spacing.sm }}>
              <AppText style={{ fontSize: 17, fontWeight: '700' }}>{tile.title}</AppText>
              <AppText style={{ color: colors.muted }}>{tile.body}</AppText>
              {tile.disabledReason ? <AppText accessibilityLabel={`${tile.title} unavailable: ${tile.disabledReason}`} style={{ color: colors.danger }}>{tile.disabledReason}</AppText> : null}
              <AppButton title="Open" disabled={Boolean(tile.disabledReason)} onPress={() => router.push(tile.href)} />
            </AppCard>
          ))}
        </View>
      </FormScroll>
    </AppScreen>
  );
}
