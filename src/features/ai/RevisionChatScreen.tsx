import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { studentAiApi } from '@/api/academics/ai-learning';
import type { RevisionChatMessage, TextRevisionSession } from '@/api/contracts/ai-learning';
import { AppButton, AppCard, AppScreen, AppText } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { ErrorPanel, Notice, Section } from '@/features/performance/components';
import type { ErrorPresentation } from '@/features/performance/format';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { confirmAction } from '@/features/teacher-ops/hooks';
import { BackButton, ButtonRow, SkeletonList } from '@/features/teacher-ops/ui';

import { ChatBubble, ChatShell, type ChatTurn } from './chat';
import { describeAiError } from './errors';
import { RevisionSetupPanel, useRevisionSetup } from './revision-setup';

const followUpsOf = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []);

let counter = 0;
const nextId = () => `rev-${++counter}`;
const toTurns = (messages: RevisionChatMessage[]): ChatTurn[] => messages.map((message) => ({ id: nextId(), role: message.role, text: message.text }));

interface Live {
  sessionId: string;
  title: string;
  chapters: string[];
  keyPoints: string[];
  turns: ChatTurn[];
  lastFollowUps: string[];
}

export default function RevisionChatScreen() {
  const setup = useRevisionSetup();
  const active = useRemoteData('ai-rev-active', () => studentAiApi.activeRevision());
  const [live, setLive] = useState<Live | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<ErrorPresentation | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [finished, setFinished] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => () => abortRef.current?.abort(), []);

  const textCapability = setup.config.data?.capabilities.text;
  const voiceBlocked = active.data?.session?.mode === 'VOICE';

  const begin = (session: TextRevisionSession) => {
    setFinished(null);
    setLive({
      sessionId: session.sessionId,
      title: `${session.subjectName ?? 'Revision'} · ${session.studyPhaseLabel ?? ''}`.trim(),
      chapters: session.chapters.map((chapter) => chapter.name),
      keyPoints: session.keyPoints ?? [],
      turns: toTurns(session.messages ?? (session.overview ? [{ role: 'assistant', text: session.overview }] : [])),
      lastFollowUps: [],
    });
  };

  const start = async () => {
    if (!setup.canStart || lock.current || !setup.subjectId || !setup.phase) return;
    lock.current = true;
    setStarting(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      begin(await studentAiApi.startTextRevision({ subjectId: setup.subjectId, studyPhase: setup.phase, chapterIds: setup.selectedIds }, { signal: controller.signal }));
      void active.reload();
    } catch (caught) {
      if (!controller.signal.aborted) setError(describeAiError(caught));
    } finally {
      lock.current = false;
      setStarting(false);
    }
  };

  const resume = () => {
    const session = active.data?.session;
    if (!session || session.mode !== 'TEXT') return;
    setFinished(null);
    setLive({ sessionId: session.sessionId, title: `${session.subjectName} · ${session.studyPhaseLabel}`, chapters: session.chapters.map((chapter) => chapter.name), keyPoints: [], turns: toTurns(session.messages), lastFollowUps: [] });
  };

  const send = async (override?: string) => {
    const message = (override ?? input).trim();
    if (!message || !live || lock.current) return;
    lock.current = true;
    setSending(true);
    setError(null);
    setLastMessage(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const mine: ChatTurn = { id: nextId(), role: 'user', text: message };
    setLive((current) => (current ? { ...current, turns: [...current.turns, mine] } : current));
    setInput('');
    try {
      const response = await studentAiApi.sendRevisionMessage(live.sessionId, message, { signal: controller.signal });
      setLive((current) => (current ? { ...current, turns: [...current.turns, { id: nextId(), role: 'assistant', text: typeof response.reply === 'string' && response.reply.trim() ? response.reply : 'Let us keep revising. What would you like to go over next?', followUps: followUpsOf(response.followUpQuestions) }], lastFollowUps: followUpsOf(response.followUpQuestions) } : current));
    } catch (caught) {
      setLive((current) => (current ? { ...current, turns: current.turns.filter((turn) => turn.id !== mine.id) } : current));
      if (controller.signal.aborted) setInput(message);
      else { setError(describeAiError(caught)); setLastMessage(message); }
    } finally {
      lock.current = false;
      setSending(false);
      abortRef.current = null;
    }
  };

  const end = async () => {
    if (!live || lock.current) return;
    if (!(await confirmAction('End revision?', 'Your revision session will be closed.', 'End session'))) return;
    lock.current = true;
    try {
      const result = await studentAiApi.endTextRevision(live.sessionId);
      setFinished(result.summary ?? 'Revision session ended.');
      setLive(null);
      void active.reload();
    } catch (caught) {
      setError(describeAiError(caught));
    } finally {
      lock.current = false;
    }
  };

  const endStale = async (sessionId: string) => {
    try {
      await studentAiApi.endTextRevision(sessionId);
      void active.reload();
    } catch (caught) {
      setError(describeAiError(caught));
    }
  };

  if (live) {
    return (
      <AppScreen style={{ padding: 0 }}>
        <ChatShell input={input} onInput={setInput} onSend={() => void send()} sending={sending} onCancel={() => abortRef.current?.abort()} placeholder="Answer or ask a question…">
          <BackButton />
          <AppText accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800' }}>{live.title}</AppText>
          <AppText style={{ color: colors.muted }}>Revising: {live.chapters.join(', ')}</AppText>
          {live.keyPoints.length ? (
            <AppCard style={{ gap: spacing.xs }}>
              <AppText style={{ fontWeight: '700' }}>Key points</AppText>
              {live.keyPoints.map((point) => <AppText key={point}>• {point}</AppText>)}
            </AppCard>
          ) : null}
          {live.turns.map((turn, index) => (
            <ChatBubble key={turn.id} turn={index === live.turns.length - 1 && live.lastFollowUps.length ? { ...turn, followUps: live.lastFollowUps } : turn} disabled={sending} onFollowUp={(question) => void send(question)} />
          ))}
          {sending ? <AppText accessibilityRole="progressbar" style={{ color: colors.muted }}>Your tutor is thinking…</AppText> : null}
          {error ? <ErrorPanel error={error} onRetry={() => (lastMessage ? void send(lastMessage) : setError(null))} /> : null}
          <AppButton title="End revision" disabled={sending} onPress={() => void end()} />
        </ChatShell>
      </AppScreen>
    );
  }

  return (
    <AppScreen style={{ padding: 0 }}>
      <ChatShell input="" onInput={() => undefined} onSend={() => undefined} sending={false} onCancel={() => undefined} placeholder="Start a revision session to chat" disabled>
        <BackButton />
        <AppText accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>Chapter revision</AppText>
        <AppText style={{ color: colors.muted }}>Guided revision on the chapters you choose.</AppText>
        {finished ? <Notice>{finished}</Notice> : null}
        {active.loading ? <SkeletonList rows={1} /> : null}
        {active.data?.session ? (
          <AppCard style={{ gap: spacing.sm }}>
            <AppText style={{ fontWeight: '700' }}>You have an unfinished revision session</AppText>
            <AppText style={{ color: colors.muted }}>{active.data.session.subjectName} · {active.data.session.studyPhaseLabel} · {active.data.session.mode === 'TEXT' ? 'chat' : 'voice'}</AppText>
            <ButtonRow>
              {active.data.session.mode === 'TEXT' ? <AppButton title="Resume session" onPress={resume} /> : <AppButton title="Open voice revision" onPress={() => router.push('/ai/revision-voice')} />}
              {active.data.session.mode === 'TEXT' ? <AppButton title="End it" onPress={() => void endStale((active.data?.session as { sessionId: string }).sessionId)} /> : null}
            </ButtonRow>
          </AppCard>
        ) : null}
        {textCapability && !textCapability.available ? <Notice tone="warning">{textCapability.disabledReason ?? 'Text revision is unavailable.'}</Notice> : null}
        {voiceBlocked ? <Notice tone="warning">A voice revision session is active. Open or end it before starting chat revision.</Notice> : null}
        <Section title="Choose what to revise">
          <RevisionSetupPanel setup={setup} disabled={starting} />
        </Section>
        {error ? <ErrorPanel error={error} onRetry={() => setError(null)} /> : null}
        <View>
          <AppButton title="Start revision chat" loading={starting} disabled={!setup.canStart || starting || (textCapability ? !textCapability.available : false) || Boolean(active.data?.session)} onPress={() => void start()} />
        </View>
      </ChatShell>
    </AppScreen>
  );
}
