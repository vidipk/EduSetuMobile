import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { studentWorkApi } from '@/api/academics/student-work';
import { normalizeApiError } from '@/api/client/error';
import type { QuizAnswerMap, QuizAnswerValue, QuizAttemptResult, StartQuizAttemptResponse, StudentQuizDetail, StudentQuizQuestion } from '@/api/contracts/student-work';
import { AppButton, AppCard, AppScreen, AppText, ErrorState, LoadingState } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';
import { formatDate, formatDateTime, isFinalQuizAttempt, latestQuizAttempt, normalizeQuizOptions, quizLifecycleState, quizStatus, resultScoreText } from '../work-utils';

type Mode = 'questions' | 'review' | 'result';
type Draft = { attemptId: string; answers: QuizAnswerMap };

export default function StudentQuizDetailScreen() {
  const { quizId } = useLocalSearchParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<StudentQuizDetail | null>(null);
  const [attempt, setAttempt] = useState<StartQuizAttemptResponse | null>(null);
  const [answers, setAnswers] = useState<QuizAnswerMap>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [mode, setMode] = useState<Mode>('questions');
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const attemptRef = useRef<StartQuizAttemptResponse | null>(null);

  const draftKey = quizId ? `edusetu.quiz-draft.${quizId}` : null;

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  const load = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const [detail, assigned] = await Promise.all([studentWorkApi.getQuiz(quizId), studentWorkApi.listQuizzes()]);
      const assignedQuiz = assigned.find((item) => item.id === quizId);
      const nextQuiz = { ...detail, attempts: assignedQuiz?.attempts ?? detail.attempts ?? [] };
      const previousAttempt = attemptRef.current;
      const existingAttempt = latestQuizAttempt(nextQuiz) ?? (isFinalQuizAttempt(previousAttempt) ? previousAttempt : null);
      setQuiz(nextQuiz);
      setAttempt(existingAttempt);
      if (draftKey && existingAttempt?.status === 'IN_PROGRESS') {
        const saved = await readDraft(draftKey);
        if (saved?.attemptId === existingAttempt.id) setAnswers(saved.answers);
      } else if (draftKey && isFinalQuizAttempt(existingAttempt)) {
        await SecureStore.deleteItemAsync(draftKey);
        setAnswers({});
      }
      if (existingAttempt?.status === 'SUBMITTED' || existingAttempt?.status === 'EVALUATED') setMode('result');
    } catch (loadError) {
      setError(normalizeApiError(loadError).message);
    } finally {
      setLoading(false);
    }
  }, [draftKey, quizId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    if (!draftKey || !attempt || attempt.status !== 'IN_PROGRESS') return;
    const timeout = setTimeout(() => { void writeDraft(draftKey, { attemptId: attempt.id, answers }); }, 250);
    return () => clearTimeout(timeout);
  }, [answers, attempt, draftKey]);

  const startQuiz = async () => {
    if (!quizId || starting || submitting || isFinalQuizAttempt(attempt)) return;
    setStarting(true);
    setActionError(null);
    try {
      const nextAttempt = await studentWorkApi.startQuiz(quizId);
      if (isFinalQuizAttempt(nextAttempt)) {
        setAttempt(nextAttempt);
        setMode('result');
        return;
      }
      setAttempt(nextAttempt);
      setMode('questions');
    } catch (startError) {
      setActionError(normalizeApiError(startError).message);
    } finally {
      setStarting(false);
    }
  };

  const submit = async () => {
    if (!attempt || submitting || attempt.status !== 'IN_PROGRESS') return;
    setSubmitting(true);
    setActionError(null);
    try {
      const nextResult = await studentWorkApi.submitQuizAttempt(attempt.id, { answers });
      setResult(nextResult);
      setAttempt(normalizeResultAttempt(nextResult, attempt.id));
      if (draftKey) await SecureStore.deleteItemAsync(draftKey);
      setMode('result');
      await load();
    } catch (submitError) {
      setActionError(`${normalizeApiError(submitError).message} Your draft is still saved on this device. Refresh before trying again if you are not sure whether the submission reached the server.`);
    } finally {
      setSubmitting(false);
    }
  };

  const loadResult = async () => {
    if (!attempt) return;
    setActionError(null);
    try {
      setResult(await studentWorkApi.getQuizAttemptResult(attempt.id));
      setMode('result');
    } catch (resultError) {
      setActionError(normalizeApiError(resultError).message);
    }
  };

  if (loading) return <AppScreen><LoadingState label="Loading quiz..." /></AppScreen>;
  if (error || !quiz) return <AppScreen><ErrorContent message={error ?? 'Quiz was not found.'} onRetry={() => void load()} /></AppScreen>;

  return (
    <QuizContent
      quiz={quiz}
      attempt={attempt}
      answers={answers}
      actionError={actionError}
      currentIndex={index}
      mode={mode}
      result={result}
      starting={starting}
      submitting={submitting}
      onAnswer={(questionId, value) => setAnswers((current) => ({ ...current, [questionId]: value }))}
      onBack={() => router.back()}
      onIndex={setIndex}
      onMode={setMode}
      onRefresh={() => void load()}
      onResult={() => void loadResult()}
      onStart={() => void startQuiz()}
      onSubmit={() => void submit()}
    />
  );
}

function QuizContent({ quiz, attempt, answers, actionError, currentIndex, mode, result, starting, submitting, onAnswer, onBack, onIndex, onMode, onRefresh, onResult, onStart, onSubmit }: {
  quiz: StudentQuizDetail;
  attempt: StartQuizAttemptResponse | null;
  answers: QuizAnswerMap;
  actionError: string | null;
  currentIndex: number;
  mode: Mode;
  result: QuizAttemptResult | null;
  starting: boolean;
  submitting: boolean;
  onAnswer: (questionId: string, value: QuizAnswerValue) => void;
  onBack: () => void;
  onIndex: (index: number) => void;
  onMode: (mode: Mode) => void;
  onRefresh: () => void;
  onResult: () => void;
  onStart: () => void;
  onSubmit: () => void;
}) {
  const status = quizStatus({ ...quiz, attempts: attempt ? [attempt] : quiz.attempts });
  const lifecycle = quizLifecycleState({ attempts: attempt ? [attempt] : quiz.attempts });
  const questions = useMemo(() => quiz.questions ?? [], [quiz.questions]);
  const current = questions[currentIndex];
  const answeredCount = useMemo(() => questions.filter((question) => hasAnswer(answers[question.id])).length, [answers, questions]);
  const canSubmit = attempt?.status === 'IN_PROGRESS' && questions.every((question) => isSupported(question) && !question.configurationError);

  return (
    <AppScreen style={styles.screen}>
      <Stack.Screen options={{ title: 'Quiz' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppButton title="Back to tasks" onPress={onBack} />
        <View style={styles.header}>
          <AppText style={styles.eyebrow}>{quiz.subject?.name ?? 'Quiz'}</AppText>
          <AppText style={styles.title}>{quiz.title}</AppText>
        </View>
        <AppCard style={styles.summary}>
          <Meta label="Status" value={status.label} />
          <Meta label="Assigned" value={formatDate(quiz.createdAt)} />
          <Meta label="Duration" value={`${quiz.durationMinutes} min`} />
          <Meta label="Progress" value={`${answeredCount}/${questions.length} answered`} />
          <Meta label="Marks" value={`${quiz.totalMarks}`} />
          {attempt?.submittedAt ? <Meta label="Submitted" value={formatDateTime(attempt.submittedAt)} /> : null}
        </AppCard>
        {actionError ? <AppText accessibilityRole="alert" style={styles.error}>{actionError}</AppText> : null}
        {lifecycle === 'NOT_STARTED' ? <AppButton title="Start quiz" loading={starting} disabled={starting || !questions.length} onPress={onStart} /> : null}
        {attempt?.status === 'IN_PROGRESS' && mode === 'questions' && current ? (
          <>
            <QuestionStepper questions={questions} currentIndex={currentIndex} answers={answers} onIndex={onIndex} />
            <QuestionCard question={current} value={answers[current.id]} onAnswer={(value) => onAnswer(current.id, value)} />
            <View style={styles.actions}>
              <AppButton title="Previous" disabled={currentIndex === 0} onPress={() => onIndex(Math.max(0, currentIndex - 1))} />
              <AppButton title={currentIndex === questions.length - 1 ? 'Review' : 'Next'} onPress={() => currentIndex === questions.length - 1 ? onMode('review') : onIndex(currentIndex + 1)} />
            </View>
          </>
        ) : null}
        {attempt?.status === 'IN_PROGRESS' && mode === 'review' ? (
          <ReviewCard questions={questions} answers={answers} canSubmit={canSubmit} submitting={submitting} onEdit={(nextIndex) => { onIndex(nextIndex); onMode('questions'); }} onSubmit={onSubmit} />
        ) : null}
        {(attempt?.status === 'SUBMITTED' || attempt?.status === 'EVALUATED' || mode === 'result') ? (
          <ResultCard attempt={attempt} result={result} onRefresh={onRefresh} onResult={onResult} />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function QuestionStepper({ questions, currentIndex, answers, onIndex }: { questions: StudentQuizQuestion[]; currentIndex: number; answers: QuizAnswerMap; onIndex: (index: number) => void }) {
  return (
    <View style={styles.stepper}>
      {questions.map((question, index) => (
        <Pressable key={question.id} accessibilityRole="button" onPress={() => onIndex(index)} style={[styles.dot, hasAnswer(answers[question.id]) && styles.dotAnswered, index === currentIndex && styles.dotActive]}>
          <AppText style={[styles.dotText, (hasAnswer(answers[question.id]) || index === currentIndex) && styles.dotTextActive]}>{index + 1}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function QuestionCard({ question, value, onAnswer }: { question: StudentQuizQuestion; value: QuizAnswerValue | undefined; onAnswer: (value: QuizAnswerValue) => void }) {
  const options = normalizeQuizOptions(question);
  return (
    <AppCard style={styles.questionCard}>
      <AppText style={styles.questionNumber}>Question {question.orderIndex + 1}</AppText>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <Meta label="Type" value={question.questionType.replace(/_/g, ' ')} />
      <Meta label="Marks" value={`${question.marks}`} />
      {question.configurationError ? <AppText style={styles.error}>This question is missing student-safe answer options.</AppText> : null}
      {question.questionType === 'MCQ' ? <ChoiceList options={options} selected={typeof value === 'string' ? value : undefined} onSelect={onAnswer} /> : null}
      {question.questionType === 'TRUE_FALSE' ? <ChoiceList options={[{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }]} selected={typeof value === 'boolean' ? String(value) : undefined} onSelect={(next) => onAnswer(next === 'true')} /> : null}
      {question.questionType === 'SHORT_ANSWER' || question.questionType === 'LONG_ANSWER' ? (
        <TextInput
          accessibilityLabel="Answer"
          multiline
          onChangeText={onAnswer}
          placeholder="Type your answer"
          placeholderTextColor={colors.muted}
          style={styles.answerInput}
          textAlignVertical="top"
          value={typeof value === 'string' ? value : ''}
        />
      ) : null}
      {!isSupported(question) ? <AppText style={styles.error}>This question type is not supported in the mobile quiz attempt flow yet.</AppText> : null}
    </AppCard>
  );
}

function ChoiceList({ options, selected, onSelect }: { options: { id: string; text?: string }[]; selected?: string; onSelect: (id: string) => void }) {
  return (
    <View style={styles.choices}>
      {options.map((option) => (
        <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected === option.id }} onPress={() => onSelect(option.id)} style={[styles.choice, selected === option.id && styles.choiceSelected]}>
          <AppText style={[styles.choiceText, selected === option.id && styles.choiceTextSelected]}>{option.text ?? option.id}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function ReviewCard({ questions, answers, canSubmit, submitting, onEdit, onSubmit }: { questions: StudentQuizQuestion[]; answers: QuizAnswerMap; canSubmit: boolean; submitting: boolean; onEdit: (index: number) => void; onSubmit: () => void }) {
  return (
    <AppCard style={styles.questionCard}>
      <AppText style={styles.sectionTitle}>Review answers</AppText>
      {questions.map((question, index) => (
        <Pressable key={question.id} accessibilityRole="button" onPress={() => onEdit(index)} style={styles.reviewRow}>
          <AppText style={styles.metaValue}>Question {index + 1}</AppText>
          <AppText style={[styles.metaLabel, hasAnswer(answers[question.id]) ? styles.answered : styles.unanswered]}>{hasAnswer(answers[question.id]) ? 'Answered' : 'Not answered'}</AppText>
        </Pressable>
      ))}
      {!canSubmit ? <AppText style={styles.error}>Some questions cannot be submitted from mobile because their type or options are not supported.</AppText> : null}
      <AppButton title="Submit quiz" loading={submitting} disabled={submitting || !canSubmit} onPress={onSubmit} />
    </AppCard>
  );
}

function ResultCard({ attempt, result, onRefresh, onResult }: { attempt: StartQuizAttemptResponse | null; result: QuizAttemptResult | null; onRefresh: () => void; onResult: () => void }) {
  const score = result ? resultScoreText(result) : null;
  const released = Boolean(score || result?.overallFeedback || attempt?.gradingStatus === 'GRADED' || attempt?.status === 'EVALUATED');
  return (
    <AppCard style={styles.questionCard}>
      <AppText style={styles.sectionTitle}>Submission</AppText>
      <Meta label="Status" value={released ? 'Result released' : 'Awaiting review'} />
      {attempt?.id ? <Meta label="Attempt" value={attempt.id} /> : null}
      {attempt?.submittedAt ? <Meta label="Submitted" value={formatDateTime(attempt.submittedAt)} /> : null}
      {score ? <Meta label="Score" value={score} /> : null}
      {result?.overallFeedback ? <AppText style={styles.description}>{result.overallFeedback}</AppText> : null}
      {!released ? <AppText style={styles.description}>{result?.pendingMessage ?? 'Your quiz has been submitted and is awaiting teacher review.'}</AppText> : null}
      {released && result?.answers?.length ? result.answers.map((answer) => (
        <View key={answer.answerId ?? answer.questionId} style={styles.resultAnswer}>
          <AppText style={styles.metaValue}>Question {answer.questionNumber ?? ''}</AppText>
          {answer.awardedMarks !== null && answer.awardedMarks !== undefined ? <AppText style={styles.metaLabel}>Marks: {answer.awardedMarks}</AppText> : null}
          {answer.teacherFeedback ? <AppText style={styles.description}>{answer.teacherFeedback}</AppText> : null}
        </View>
      )) : null}
      <View style={styles.actions}>
        <AppButton title="Refresh" onPress={onRefresh} />
        <AppButton title="View result" onPress={onResult} />
      </View>
    </AppCard>
  );
}

function ErrorContent({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.center}><ErrorState message={message} /><AppButton title="Retry" onPress={onRetry} /></View>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <View style={styles.meta}><AppText style={styles.metaLabel}>{label}</AppText><AppText style={styles.metaValue}>{value}</AppText></View>;
}

function hasAnswer(value: QuizAnswerValue | undefined) {
  return typeof value === 'boolean' || (typeof value === 'string' && value.trim().length > 0);
}

function isSupported(question: StudentQuizQuestion) {
  return ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'LONG_ANSWER'].includes(question.questionType) && !question.configurationError;
}

async function readDraft(key: string): Promise<Draft | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? JSON.parse(raw) as Draft : null;
  } catch {
    return null;
  }
}

async function writeDraft(key: string, draft: Draft) {
  await SecureStore.setItemAsync(key, JSON.stringify(draft));
}

function normalizeResultAttempt(result: QuizAttemptResult, fallbackId: string): StartQuizAttemptResponse {
  if (result.attempt) return result.attempt;
  return {
    id: result.id ?? fallbackId,
    status: result.status ?? 'SUBMITTED',
    score: result.score ?? null,
    autoScore: result.autoScore ?? null,
    gradingStatus: result.gradingStatus ?? 'PENDING_REVIEW',
    submittedAt: result.submittedAt ?? null,
  };
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: { flex: 1, gap: spacing.md },
  header: { gap: spacing.sm },
  eyebrow: { color: colors.student, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', lineHeight: 34 },
  description: { color: colors.muted, lineHeight: 22 },
  summary: { gap: spacing.sm },
  questionCard: { gap: spacing.md },
  questionNumber: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  questionText: { fontSize: 17, fontWeight: '700', lineHeight: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  meta: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  metaLabel: { color: colors.muted, flexShrink: 0, fontSize: 13 },
  metaValue: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  stepper: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dot: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  dotActive: { backgroundColor: colors.student, borderColor: colors.student },
  dotAnswered: { backgroundColor: colors.success, borderColor: colors.success },
  dotText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  dotTextActive: { color: '#fff' },
  choices: { gap: spacing.sm },
  choice: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  choiceSelected: { backgroundColor: colors.student, borderColor: colors.student },
  choiceText: { color: colors.text, lineHeight: 22 },
  choiceTextSelected: { color: '#fff', fontWeight: '700' },
  answerInput: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 120, padding: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  reviewRow: { borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  resultAnswer: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm },
  answered: { color: colors.success },
  unanswered: { color: colors.danger },
  error: { color: colors.danger, lineHeight: 20 },
});
