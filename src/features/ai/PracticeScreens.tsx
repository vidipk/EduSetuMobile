import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { studentAiApi } from '@/api/academics/ai-learning';
import type { Difficulty, Flashcard, GenerationScope, PracticeQuestion, PracticeQuestionType } from '@/api/contracts/ai-learning';
import { AppButton, AppCard, AppScreen, AppText } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { Chips, ErrorPanel, Notice } from '@/features/performance/components';
import type { ErrorPresentation } from '@/features/performance/format';
import { BackButton, FormScroll } from '@/features/teacher-ops/ui';

import { describeAiError } from './errors';
import { ScopePicker, useStudentScope } from './scope';

const DIFFICULTIES: { id: Difficulty; label: string }[] = [{ id: 'easy', label: 'Easy' }, { id: 'medium', label: 'Medium' }, { id: 'hard', label: 'Hard' }];
const TYPES: { id: PracticeQuestionType; label: string }[] = [{ id: 'mcq', label: 'Multiple choice' }, { id: 'short_answer', label: 'Short answer' }, { id: 'numerical', label: 'Numerical' }, { id: 'mixed', label: 'Mixed' }];

/** Shared generation flow: scope, difficulty, one in-flight request, cancel and retry. */
function useGeneration<T>(flag: 'flashcardsEnabled' | 'practiceQuestionsEnabled', run: (scope: GenerationScope, signal: AbortSignal) => Promise<T>) {
  const scope = useStudentScope();
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [result, setResult] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorPresentation | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => () => abortRef.current?.abort(), []);

  const availability = scope.dashboard.data?.featureAvailability;
  const aiEnabled = availability ? availability.studentAiEnabled && availability[flag] !== false : true;
  const ready = Boolean(scope.profile && scope.subject && scope.chapter && aiEnabled);

  const generate = async () => {
    if (!ready || lock.current || !scope.profile || !scope.subject || !scope.chapter) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const next = await run({ classId: scope.profile.class.id, sectionId: scope.profile.section.id, subjectId: scope.subject.id, chapter: scope.chapter.title, topic: scope.chapter.title, difficulty }, controller.signal);
      setResult(next);
    } catch (caught) {
      if (!controller.signal.aborted) setError(describeAiError(caught));
    } finally {
      lock.current = false;
      setBusy(false);
      abortRef.current = null;
    }
  };

  return {
    scope: { ...scope, selectSubject: (id: string) => { scope.selectSubject(id); setResult(null); }, selectChapter: (id: string) => { scope.selectChapter(id); setResult(null); } },
    difficulty,
    setDifficulty,
    result,
    busy,
    error,
    ready,
    aiEnabled,
    generate,
    cancel: () => abortRef.current?.abort(),
  };
}

export function PracticeScreen() {
  const [type, setType] = useState<PracticeQuestionType>('mcq');
  const gen = useGeneration('practiceQuestionsEnabled', (scope, signal) => studentAiApi.generatePractice({ ...scope, questionType: type, numberOfQuestions: 5 }, { signal }));

  return (
    <AppScreen style={{ padding: 0 }}>
      <FormScroll>
        <BackButton />
        <AppText accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>Practice questions</AppText>
        <AppText style={{ color: colors.muted }}>Practice only. Nothing here is graded or added to your marks.</AppText>
        {!gen.aiEnabled ? <Notice tone="warning">This feature is not enabled for students by your school.</Notice> : null}
        <ScopePicker scope={gen.scope} disabled={gen.busy} />
        <Chips label="Difficulty" options={DIFFICULTIES} value={gen.difficulty} onChange={(value) => gen.setDifficulty(value as Difficulty)} />
        <Chips label="Question type" options={TYPES} value={type} onChange={(value) => { setType(value as PracticeQuestionType); }} />
        {gen.error ? <ErrorPanel error={gen.error} onRetry={() => void gen.generate()} /> : null}
        {gen.busy ? <AppButton title="Cancel" onPress={gen.cancel} /> : <AppButton title={gen.result ? 'Generate new questions' : 'Generate questions'} disabled={!gen.ready} onPress={() => void gen.generate()} />}
        {gen.busy ? <AppText accessibilityRole="progressbar" style={{ color: colors.muted }}>Preparing your questions…</AppText> : null}
        {gen.result && gen.result.questions.length === 0 ? <AppText>No questions could be prepared. Try again.</AppText> : null}
        {gen.result?.questions.map((question, index) => <QuestionCard key={`${gen.result?.conversationId}-${index}`} index={index} question={question} />)}
      </FormScroll>
    </AppScreen>
  );
}

function QuestionCard({ question, index }: { question: PracticeQuestion; index: number }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const hasOptions = question.options.length > 0;
  return (
    <AppCard style={{ gap: spacing.sm }}>
      <AppText style={{ fontWeight: '700' }}>Q{index + 1}. {question.question}</AppText>
      {hasOptions ? question.options.map((option) => {
        const isAnswer = revealed && option === question.answer;
        const isWrong = revealed && picked === option && option !== question.answer;
        return (
          <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: picked === option }} disabled={revealed} onPress={() => setPicked(option)} style={{ borderColor: isAnswer ? colors.success : isWrong ? colors.danger : picked === option ? colors.primary : colors.border, borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: 'center', padding: spacing.sm }}>
            <AppText>{option}{isAnswer ? ' ✓' : ''}</AppText>
          </Pressable>
        );
      }) : null}
      {revealed ? (
        <View style={{ gap: 4 }}>
          <AppText style={{ fontWeight: '700' }}>Answer: {question.answer}</AppText>
          {question.explanation ? <AppText style={{ color: colors.muted }}>{question.explanation}</AppText> : null}
        </View>
      ) : <AppButton title="Show answer" onPress={() => setRevealed(true)} />}
    </AppCard>
  );
}

export function FlashcardsScreen() {
  const gen = useGeneration('flashcardsEnabled', (scope, signal) => studentAiApi.generateFlashcards({ ...scope, numberOfCards: 8 }, { signal }));
  return (
    <AppScreen style={{ padding: 0 }}>
      <FormScroll>
        <BackButton />
        <AppText accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>Flashcards</AppText>
        <AppText style={{ color: colors.muted }}>Tap a card to flip it. Flashcards are for revision only.</AppText>
        {!gen.aiEnabled ? <Notice tone="warning">This feature is not enabled for students by your school.</Notice> : null}
        <ScopePicker scope={gen.scope} disabled={gen.busy} />
        <Chips label="Difficulty" options={DIFFICULTIES} value={gen.difficulty} onChange={(value) => gen.setDifficulty(value as Difficulty)} />
        {gen.error ? <ErrorPanel error={gen.error} onRetry={() => void gen.generate()} /> : null}
        {gen.busy ? <AppButton title="Cancel" onPress={gen.cancel} /> : <AppButton title={gen.result ? 'Generate new cards' : 'Generate flashcards'} disabled={!gen.ready} onPress={() => void gen.generate()} />}
        {gen.busy ? <AppText accessibilityRole="progressbar" style={{ color: colors.muted }}>Preparing your flashcards…</AppText> : null}
        {gen.result && gen.result.flashcards.length === 0 ? <AppText>No flashcards could be prepared. Try again.</AppText> : null}
        {gen.result?.flashcards.map((card, index) => <FlipCard key={`${gen.result?.conversationId}-${index}`} card={card} />)}
      </FormScroll>
    </AppScreen>
  );
}

function FlipCard({ card }: { card: Flashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={flipped ? `Answer: ${card.back}. Tap to see the question.` : `Question: ${card.front}. Tap to flip.`} onPress={() => setFlipped(!flipped)}>
      <AppCard style={{ gap: spacing.xs, minHeight: 96 }}>
        <AppText style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{flipped ? 'ANSWER' : 'QUESTION'}</AppText>
        <AppText style={{ fontSize: 16, fontWeight: '700' }}>{flipped ? card.back : card.front}</AppText>
        {!flipped && card.hint ? <AppText style={{ color: colors.muted }}>Hint: {card.hint}</AppText> : null}
      </AppCard>
    </Pressable>
  );
}
