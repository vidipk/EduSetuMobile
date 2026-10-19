import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { studentAiApi } from '@/api/academics/ai-learning';
import type { ConversationDetail } from '@/api/contracts/ai-learning';
import { AppButton, AppScreen, AppText } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { ErrorPanel, Notice } from '@/features/performance/components';
import type { ErrorPresentation } from '@/features/performance/format';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { BackButton, SkeletonList } from '@/features/teacher-ops/ui';

import { ChatBubble, ChatShell, type ChatTurn } from './chat';
import { describeAiError } from './errors';
import { ScopePicker, useStudentScope, type StudentScope } from './scope';

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const asStrings = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []);

let turnCounter = 0;
const nextId = () => `turn-${++turnCounter}`;

function turnsFromConversation(detail: ConversationDetail): ChatTurn[] {
  return detail.messages.flatMap((message): ChatTurn[] => {
    const content = message.content ?? {};
    if (message.sender === 'USER') {
      return typeof content.text === 'string' ? [{ id: message.id, role: 'user', text: content.text }] : [];
    }
    const answer = typeof content.answer === 'string' ? content.answer : '';
    if (!answer) return [];
    return [{
      id: message.id,
      role: 'assistant',
      text: answer,
      example: typeof content.example === 'string' && content.example ? content.example : undefined,
      practiceSuggestion: typeof content.practiceSuggestion === 'string' && content.practiceSuggestion ? content.practiceSuggestion : undefined,
      followUps: Array.isArray(content.followUpQuestions) ? content.followUpQuestions.filter((entry): entry is string => typeof entry === 'string') : undefined,
    }];
  });
}

export default function DoubtChatScreen() {
  const baseScope = useStudentScope();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ErrorPresentation | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lock = useRef(false);

  // Leaving the screen cancels any in-flight request.
  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = () => {
    setTurns([]);
    setConversationId(null);
    setError(null);
    setLastQuestion(null);
    setShowHistory(false);
  };
  const scope: StudentScope = {
    ...baseScope,
    selectSubject: (id) => { baseScope.selectSubject(id); reset(); },
    selectChapter: (id) => { baseScope.selectChapter(id); reset(); },
  };
  const availability = baseScope.dashboard.data?.featureAvailability;
  const aiEnabled = availability ? availability.studentAiEnabled && availability.textDoubtEnabled !== false : true;
  const ready = Boolean(scope.subject && scope.chapter && aiEnabled);

  const send = async (override?: string) => {
    const question = (override ?? input).trim();
    if (!question || !scope.subject || !scope.chapter || lock.current) return;
    lock.current = true;
    setSending(true);
    setError(null);
    setLastQuestion(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const userTurn: ChatTurn = { id: nextId(), role: 'user', text: question };
    setTurns((current) => [...current, userTurn]);
    setInput('');
    try {
      const response = await studentAiApi.askChapterDoubt(
        { conversationId: conversationId ?? undefined, subjectId: scope.subject.id, chapterId: scope.chapter.id, question },
        { signal: controller.signal },
      );
      setConversationId(response.conversationId);
      setTurns((current) => [...current, {
        id: nextId(),
        role: 'assistant',
        text: asString(response.answer) || 'The tutor could not answer that. Please try rephrasing your question.',
        example: asString(response.example) || undefined,
        practiceSuggestion: asString(response.practiceSuggestion) || undefined,
        followUps: asStrings(response.followUpQuestions),
        grounded: response.grounded,
        sources: response.sourceReferences.map((source) => ({ title: source.title, type: source.type })),
      }]);
    } catch (caught) {
      // The failed question is taken back out of the thread and offered for retry; nothing is invented.
      setTurns((current) => current.filter((turn) => turn.id !== userTurn.id));
      if (controller.signal.aborted) {
        setInput(question);
      } else {
        setError(describeAiError(caught));
        setLastQuestion(question);
      }
    } finally {
      lock.current = false;
      setSending(false);
      abortRef.current = null;
    }
  };

  const history = useRemoteData(showHistory && scope.subject ? `ai-doubt-history:${scope.subject.id}` : null, () => studentAiApi.listConversations({ module: 'DOUBT_ASSISTANT', subjectId: (scope.subject as { id: string }).id, limit: 30 }));
  const chapterHistory = (history.data?.items ?? []).filter((item) => item.chapter === scope.chapter?.title);
  const openConversation = async (id: string) => {
    try {
      const detail = await studentAiApi.conversation(id);
      setTurns(turnsFromConversation(detail));
      setConversationId(detail.id);
      setShowHistory(false);
      setError(null);
    } catch (caught) {
      setError(describeAiError(caught));
    }
  };

  return (
    <AppScreen style={{ padding: 0 }}>
      <ChatShell input={input} onInput={setInput} onSend={() => void send()} sending={sending} onCancel={() => abortRef.current?.abort()} placeholder={ready ? 'Ask your doubt…' : 'Choose a subject and chapter first'} disabled={!ready}>
        <BackButton />
        <AppText style={{ fontSize: 22, fontWeight: '800' }}>Ask AI</AppText>
        <AppText style={{ color: colors.muted }}>Doubt solving grounded in the chapter you choose.</AppText>
        {!aiEnabled ? <Notice tone="warning">Ask AI chat is not enabled for students by your school.</Notice> : null}
        <ScopePicker scope={scope} disabled={sending} />
        {ready ? <AppButton title={showHistory ? 'Hide previous chats' : 'Previous chats for this chapter'} onPress={() => setShowHistory(!showHistory)} /> : null}
        {showHistory ? (
          <View style={{ gap: spacing.sm }}>
            {history.loading ? <SkeletonList rows={1} /> : null}
            {history.error ? <ErrorPanel error={history.error} onRetry={history.reload} /> : null}
            {history.data && chapterHistory.length === 0 ? <AppText style={{ color: colors.muted }}>No previous chats for this chapter.</AppText> : null}
            {chapterHistory.map((item) => <AppButton key={item.id} title={item.title ?? 'Previous chat'} onPress={() => void openConversation(item.id)} />)}
          </View>
        ) : null}
        {turns.map((turn) => <ChatBubble key={turn.id} turn={turn} disabled={sending || !ready} onFollowUp={(question) => void send(question)} />)}
        {sending ? <AppText accessibilityRole="progressbar" style={{ color: colors.muted }}>The tutor is thinking…</AppText> : null}
        {error ? <ErrorPanel error={error} onRetry={() => (lastQuestion ? void send(lastQuestion) : setError(null))} /> : null}
        {ready && turns.length === 0 && !sending ? <AppText style={{ color: colors.muted }}>Type a question below. Answers use your school material when it is available and say so when it is not.</AppText> : null}
      </ChatShell>
    </AppScreen>
  );
}
