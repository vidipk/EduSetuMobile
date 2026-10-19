import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppButton, AppCard, AppScreen, AppText } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { ErrorPanel, Notice } from '@/features/performance/components';
import { BackButton, ButtonRow, FormScroll } from '@/features/teacher-ops/ui';

import type { UseVoiceSessionOptions } from './use-voice-session';
import { useVoiceSession } from './use-voice-session';

export const PHASE_LABEL = {
  idle: 'Ready',
  permission: 'Asking for microphone access…',
  creating: 'Starting your session…',
  connecting: 'Connecting…',
  'waiting-agent': 'Waiting for your AI tutor to join…',
  live: 'Live: speak naturally',
  reconnecting: 'Reconnecting…',
  ending: 'Ending session…',
  ended: 'Session ended',
  error: 'Session stopped',
} as const;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Shared voice UI for doubt solving and revision. `setup` holds the experience-specific scope picker;
 * a disabled reason from the backend capability check is shown instead of a start button.
 */
export function VoiceSessionView({ title, subtitle, setup, canStart, unavailableReason, create }: {
  title: string;
  subtitle: string;
  setup: ReactNode;
  canStart: boolean;
  unavailableReason: string | null;
  create: UseVoiceSessionOptions['create'];
}) {
  const voice = useVoiceSession({ create });
  const active = ['permission', 'creating', 'connecting', 'waiting-agent', 'live', 'reconnecting', 'ending'].includes(voice.phase);

  return (
    <AppScreen style={{ padding: 0 }}>
      <FormScroll>
        <BackButton />
        <AppText accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>{title}</AppText>
        <AppText style={{ color: colors.muted }}>{subtitle}</AppText>
        {unavailableReason ? <Notice tone="warning">{unavailableReason}</Notice> : null}
        {!active ? setup : null}

        {voice.phase !== 'idle' && voice.phase !== 'error' ? (
          <AppCard style={{ gap: spacing.sm }}>
            <AppText accessibilityLiveRegion="polite" style={{ fontWeight: '700' }}>{PHASE_LABEL[voice.phase]}</AppText>
            {voice.phase === 'live' && voice.agentState ? <AppText style={{ color: colors.muted }}>Tutor is {voice.agentState}</AppText> : null}
            {voice.secondsLeft !== null && voice.phase === 'live' ? <AppText style={{ color: colors.muted }}>Time left {clock(voice.secondsLeft)}</AppText> : null}
            {voice.phase === 'live' && voice.muted ? <AppText style={{ color: colors.danger }}>Your microphone is muted</AppText> : null}
          </AppCard>
        ) : null}

        {voice.failure ? <ErrorPanel error={voice.failure} onRetry={() => void voice.start()} /> : null}
        {voice.phase === 'ended' && voice.summary ? <Notice>{voice.summary}</Notice> : null}

        {voice.greeting && active ? <AppText style={{ color: colors.muted }}>{voice.greeting}</AppText> : null}
        {voice.transcript.length ? (
          <View accessibilityLabel="Conversation transcript" style={{ gap: spacing.sm }}>
            <AppText style={{ fontWeight: '700' }}>Transcript</AppText>
            {voice.transcript.map((message) => (
              <AppText key={message.id} style={message.role === 'STUDENT' ? { fontWeight: '600' } : { color: colors.muted }}>
                {message.role === 'STUDENT' ? 'You' : 'Tutor'}: {message.transcriptText}
              </AppText>
            ))}
          </View>
        ) : null}

        {active ? (
          <ButtonRow>
            {voice.phase === 'live' || voice.phase === 'reconnecting' ? <AppButton title={voice.muted ? 'Unmute' : 'Mute'} onPress={() => void voice.toggleMute()} /> : null}
            <AppButton title="End session" disabled={voice.phase === 'ending'} onPress={() => void voice.end()} />
          </ButtonRow>
        ) : (
          <AppButton title={voice.phase === 'ended' || voice.phase === 'error' ? 'Start a new voice session' : 'Start voice session'} disabled={!canStart || Boolean(unavailableReason)} onPress={() => void voice.start()} />
        )}
      </FormScroll>
    </AppScreen>
  );
}
