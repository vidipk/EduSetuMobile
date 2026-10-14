import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { studentWorkApi } from '@/api/academics/student-work';
import { normalizeApiError } from '@/api/client/error';
import type { HomeworkSubmissionMethod, StudentHomeworkDetail, StudentHomeworkQuestion } from '@/api/contracts/student-work';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppScreen, AppText, ErrorState, LoadingState } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';
import { pickDocument, type UploadDescriptor } from '@/files/uploads';
import { buildSubmissionText, buildSubmitPayload, hasHomeworkAnswer, homeworkNeedsSubjective, isMatches, isUncertainSubmitOutcome, resolveAttachment, validateHomework, validatePdf, type AnswerValue } from '../homework-submission';
import { formatDate, formatDateTime, homeworkAnswerToText, homeworkQuestionDescription, homeworkQuestionText, homeworkStatus, safeDisplayText } from '../work-utils';

type Draft = { answers: Record<string, AnswerValue>; submissionMethod?: HomeworkSubmissionMethod; driveUrl?: string; submissionText?: string };
type Mode = 'questions' | 'review' | 'submitted';

export default function StudentHomeworkDetailScreen() {
  const { homeworkId } = useLocalSearchParams<{ homeworkId: string }>();
  const { user } = useAuth();
  const [homework, setHomework] = useState<StudentHomeworkDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submissionMethod, setSubmissionMethod] = useState<HomeworkSubmissionMethod | undefined>();
  const [driveUrl, setDriveUrl] = useState('');
  const [submissionText, setSubmissionText] = useState('');
  const [file, setFile] = useState<UploadDescriptor | null>(null);
  const [mode, setMode] = useState<Mode>('questions');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const draftKey = homeworkId && user ? `edusetu.homework-draft.${user.organizationId ?? 'org'}.${user.id}.${homeworkId}` : null;

  const load = useCallback(async () => {
    if (!homeworkId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await studentWorkApi.getHomework(homeworkId);
      setHomework(next);
      if (next.submission?.submittedAt) {
        setMode('submitted');
        if (draftKey) await SecureStore.deleteItemAsync(draftKey);
        setAnswers(Object.fromEntries(next.submission.answers.map((answer) => [answer.questionId, homeworkAnswerToText(answer.answerJson)])));
      } else if (draftKey) {
        const saved = await readDraft(draftKey);
        if (saved) {
          setAnswers(saved.answers);
          setSubmissionMethod(saved.submissionMethod);
          setDriveUrl(saved.driveUrl ?? '');
          setSubmissionText(saved.submissionText ?? '');
        }
      }
    } catch (loadError) {
      setError(normalizeApiError(loadError).message);
    } finally {
      setLoading(false);
    }
  }, [draftKey, homeworkId]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 0);
    return () => clearTimeout(timeout);
  }, [load]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    if (!draftKey || mode === 'submitted' || homework?.submission?.submittedAt) return;
    const timeout = setTimeout(() => {
      void SecureStore.setItemAsync(draftKey, JSON.stringify({ answers, submissionMethod, driveUrl, submissionText } satisfies Draft));
    }, 250);
    return () => clearTimeout(timeout);
  }, [answers, draftKey, driveUrl, homework?.submission?.submittedAt, mode, submissionMethod, submissionText]);

  const markSubmitted = async (next?: StudentHomeworkDetail) => {
    if (draftKey) await SecureStore.deleteItemAsync(draftKey).catch(() => undefined);
    if (next) {
      setHomework(next);
      setAnswers(Object.fromEntries(next.submission?.answers.map((answer) => [answer.questionId, homeworkAnswerToText(answer.answerJson)]) ?? []));
    }
    setFile(null);
    setActionError(null);
    setMode('submitted');
  };

  // The request may have reached the server even if we never saw the response.
  const reconcileSubmission = async (id: string, message: string) => {
    try {
      const next = await studentWorkApi.getHomework(id);
      if (next.submission?.submittedAt) {
        await markSubmitted(next);
        return;
      }
      setActionError(`${message} We checked and your homework was not received, so it is safe to try again.`);
    } catch {
      setActionError(`${message} We could not confirm whether it was received. Check your connection and refresh before trying again.`);
    }
  };

  const submit = async () => {
    if (!homework || submitting || homework.submission?.submittedAt) return;
    const inputs = { answers, submissionMethod, driveUrl, submissionText, file };
    const validation = validateHomework(homework, inputs);
    if (validation) {
      setActionError(validation);
      setMode('questions');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await studentWorkApi.submitHomework(homework.id, buildSubmitPayload(homework, inputs));
    } catch (submitError) {
      const apiError = normalizeApiError(submitError);
      if (apiError.status === 401) {
        setActionError('Your session has expired. Please sign in again; your answers are saved on this device.');
      } else if (isUncertainSubmitOutcome(apiError)) {
        await reconcileSubmission(homework.id, apiError.status === undefined ? 'The connection was interrupted while submitting.' : apiError.message);
      } else {
        setActionError(apiError.message);
      }
      setSubmitting(false);
      return;
    }
    // Confirmed by the server: clear the draft, then pick up the stored status.
    let confirmed: StudentHomeworkDetail | undefined;
    try {
      confirmed = await studentWorkApi.getHomework(homework.id);
    } catch {
      confirmed = undefined;
    }
    await markSubmitted(confirmed);
    setSubmitting(false);
  };

  const choosePdf = async () => {
    setActionError(null);
    try {
      const picked = await pickDocument();
      if (!picked) return;
      const message = validatePdf(picked);
      if (message) {
        setActionError(message);
        return;
      }
      setFile(picked);
      setSubmissionMethod('PDF_UPLOAD');
    } catch (pickError) {
      setActionError(normalizeApiError(pickError).message);
    }
  };

  if (loading) return <AppScreen><LoadingState label="Loading homework..." /></AppScreen>;
  if (error || !homework) return <AppScreen><ErrorContent message={error ?? 'Homework was not found.'} onRetry={() => void load()} /></AppScreen>;

  return (
    <HomeworkContent
      homework={homework}
      answers={answers}
      actionError={actionError}
      driveUrl={driveUrl}
      file={file}
      mode={mode}
      submissionMethod={submissionMethod}
      submissionText={submissionText}
      submitting={submitting}
      onAnswer={(questionId, value) => setAnswers((current) => ({ ...current, [questionId]: value }))}
      onBack={() => router.back()}
      onChoosePdf={() => void choosePdf()}
      onDriveUrl={setDriveUrl}
      onMode={setMode}
      onRefresh={() => void load()}
      onSubmissionMethod={setSubmissionMethod}
      onSubmissionText={setSubmissionText}
      onSubmit={() => void submit()}
    />
  );
}

function HomeworkContent({ homework, answers, actionError, driveUrl, file, mode, submissionMethod, submissionText, submitting, onAnswer, onBack, onChoosePdf, onDriveUrl, onMode, onRefresh, onSubmissionMethod, onSubmissionText, onSubmit }: {
  homework: StudentHomeworkDetail;
  answers: Record<string, AnswerValue>;
  actionError: string | null;
  driveUrl: string;
  file: UploadDescriptor | null;
  mode: Mode;
  submissionMethod?: HomeworkSubmissionMethod;
  submissionText: string;
  submitting: boolean;
  onAnswer: (questionId: string, value: AnswerValue) => void;
  onBack: () => void;
  onChoosePdf: () => void;
  onDriveUrl: (value: string) => void;
  onMode: (mode: Mode) => void;
  onRefresh: () => void;
  onSubmissionMethod: (value: HomeworkSubmissionMethod | undefined) => void;
  onSubmissionText: (value: string) => void;
  onSubmit: () => void;
}) {
  const status = homeworkStatus({ ...homework, questionCount: homework.questions.length, submissionStatus: homework.submission?.status ?? 'NOT_SUBMITTED' });
  const description = safeDisplayText(homework.description);
  const instructions = safeDisplayText(homework.instructions);
  const answered = homework.questions.filter((question) => hasHomeworkAnswer(question, answers[question.id])).length;
  const submitted = Boolean(homework.submission?.submittedAt);
  const needsSubjective = homeworkNeedsSubjective(homework);

  return (
    <AppScreen style={styles.screen}>
      <Stack.Screen options={{ title: 'Homework' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppButton title="Back to tasks" onPress={onBack} />
        <View style={styles.header}>
          <AppText style={styles.eyebrow}>{homework.subject?.name ?? 'Homework'}</AppText>
          <AppText style={styles.title}>{homework.title}</AppText>
          {description ? <AppText style={styles.description}>{description}</AppText> : null}
        </View>
        <AppCard style={styles.summary}>
          <Meta label="Status" value={status.label} />
          <Meta label="Deadline" value={formatDate(homework.dueDate)} />
          <Meta label="Type" value={homework.homeworkType.replace(/_/g, ' ')} />
          <Meta label="Progress" value={`${answered}/${homework.questions.length} answered`} />
          {homework.totalMarks !== null ? <Meta label="Marks" value={`${homework.totalMarks}`} /> : null}
          {homework.submission?.submittedAt ? <Meta label="Submitted" value={formatDateTime(homework.submission.submittedAt)} /> : null}
          {homework.submission?.objectiveScore !== null && homework.submission?.objectiveScore !== undefined ? <Meta label="Objective score" value={`${homework.submission.objectiveScore}`} /> : null}
        </AppCard>
        {instructions ? <AppCard><AppText style={styles.sectionTitle}>Instructions</AppText><AppText style={styles.description}>{instructions}</AppText></AppCard> : null}
        {actionError ? <AppText accessibilityRole="alert" style={styles.error}>{actionError}</AppText> : null}
        {submitted || mode === 'submitted' ? <SubmittedCard homework={homework} onRefresh={onRefresh} /> : null}
        {!submitted && mode === 'questions' ? (
          <>
            <View style={styles.questions}>
              {homework.questions.map((question, index) => <QuestionCard key={question.id} index={index} question={question} value={answers[question.id]} onAnswer={(value) => onAnswer(question.id, value)} />)}
            </View>
            <SubmissionMethodCard
              driveUrl={driveUrl}
              file={file}
              needsSubjective={needsSubjective}
              submissionMethod={submissionMethod}
              submissionText={submissionText}
              onChoosePdf={onChoosePdf}
              onDriveUrl={onDriveUrl}
              onSubmissionMethod={onSubmissionMethod}
              onSubmissionText={onSubmissionText}
            />
            <AppButton title="Review submission" onPress={() => onMode('review')} />
          </>
        ) : null}
        {!submitted && mode === 'review' ? (
          <ReviewCard homework={homework} answers={answers} file={file} driveUrl={driveUrl} submissionMethod={submissionMethod} submissionText={submissionText} submitting={submitting} onEdit={() => onMode('questions')} onSubmit={onSubmit} />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function QuestionCard({ question, index, value, onAnswer }: { question: StudentHomeworkQuestion; index: number; value?: AnswerValue; onAnswer: (value: AnswerValue) => void }) {
  const description = homeworkQuestionDescription(question);
  return (
    <AppCard style={styles.questionCard}>
      <AppText style={styles.questionNumber}>Question {index + 1}{question.required ? '' : ' optional'}</AppText>
      <AppText style={styles.questionText}>{homeworkQuestionText(question)}</AppText>
      {description ? <AppText style={styles.description}>{description}</AppText> : null}
      <Meta label="Type" value={question.type.replace(/_/g, ' ')} />
      <Meta label="Marks" value={`${question.marks}`} />
      {question.type === 'MCQ' ? <ChoiceList options={question.options ?? []} selected={typeof value === 'string' ? value : undefined} onSelect={onAnswer} /> : null}
      {question.type === 'TRUE_FALSE' ? <ChoiceList options={[{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }]} selected={typeof value === 'boolean' ? String(value) : undefined} onSelect={(next) => onAnswer(next === 'true')} /> : null}
      {['FILL_IN_THE_BLANK', 'ONE_WORD_ANSWER', 'SHORT_ANSWER', 'LONG_ANSWER', 'NUMERICAL', 'DESCRIPTIVE', 'ASSIGNMENT', 'PRACTICE_SET'].includes(question.type) ? (
        <TextInput accessibilityLabel={`Answer question ${index + 1}`} multiline onChangeText={onAnswer} placeholder="Type your answer" placeholderTextColor={colors.muted} style={styles.answerInput} textAlignVertical="top" value={typeof value === 'string' ? value : ''} />
      ) : null}
      {question.type === 'MATCH_THE_COLUMNS' ? <MatchControl question={question} value={isMatches(value) ? value : {}} onAnswer={onAnswer} /> : null}
    </AppCard>
  );
}

function ChoiceList({ options, selected, onSelect }: { options: { id: string; text: string }[]; selected?: string; onSelect: (id: string) => void }) {
  return <View style={styles.choices}>{options.map((option) => <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected === option.id }} onPress={() => onSelect(option.id)} style={[styles.choice, selected === option.id && styles.choiceSelected]}><AppText style={[styles.choiceText, selected === option.id && styles.choiceTextSelected]}>{option.text}</AppText></Pressable>)}</View>;
}

function MatchControl({ question, value, onAnswer }: { question: StudentHomeworkQuestion; value: Record<string, string>; onAnswer: (value: Record<string, string>) => void }) {
  return (
    <View style={styles.choices}>
      {(question.leftItems ?? []).map((left) => (
        <View key={left.id} style={styles.matchRow}>
          <AppText style={styles.matchLeft}>{left.text}</AppText>
          <View style={styles.matchOptions}>
            {(question.rightItems ?? []).map((right) => (
              <Pressable key={right.id} accessibilityRole="button" onPress={() => onAnswer({ ...value, [left.id]: right.id })} style={[styles.matchChoice, value[left.id] === right.id && styles.choiceSelected]}>
                <AppText style={[styles.choiceText, value[left.id] === right.id && styles.choiceTextSelected]}>{right.text}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function SubmissionMethodCard({ driveUrl, file, needsSubjective, submissionMethod, submissionText, onChoosePdf, onDriveUrl, onSubmissionMethod, onSubmissionText }: {
  driveUrl: string;
  file: UploadDescriptor | null;
  needsSubjective: boolean;
  submissionMethod?: HomeworkSubmissionMethod;
  submissionText: string;
  onChoosePdf: () => void;
  onDriveUrl: (value: string) => void;
  onSubmissionMethod: (value: HomeworkSubmissionMethod | undefined) => void;
  onSubmissionText: (value: string) => void;
}) {
  const attachmentLabel = submissionMethod === 'PDF_UPLOAD' ? 'PDF' : submissionMethod === 'DRIVE_LINK' ? 'Google Drive link' : 'None (written answers only)';
  return (
    <AppCard style={styles.questionCard}>
      <AppText style={styles.sectionTitle}>Submission</AppText>
      {needsSubjective ? <AppText style={styles.description}>You can submit your written answers directly. Attaching a PDF or Google Drive link is optional; shared documents must be viewable by your teacher.</AppText> : <AppText style={styles.description}>Objective answers can be submitted directly.</AppText>}
      <TextInput accessibilityLabel={needsSubjective ? 'Written response' : 'Submission note'} multiline onChangeText={onSubmissionText} placeholder={needsSubjective ? 'Write your response here (optional if you answered the questions above)' : 'Optional note for your teacher'} placeholderTextColor={colors.muted} style={styles.answerInputSmall} textAlignVertical="top" value={submissionText} />
      <AppText style={styles.description}>Attachment: {attachmentLabel}</AppText>
      <View style={styles.actions}>
        <AppButton title="Choose PDF" onPress={onChoosePdf} />
        <AppButton title="Drive link" onPress={() => onSubmissionMethod('DRIVE_LINK')} />
        {submissionMethod ? <AppButton title="No attachment" onPress={() => onSubmissionMethod(undefined)} /> : null}
      </View>
      {submissionMethod === 'PDF_UPLOAD' && file ? <AppText style={styles.description}>Selected PDF: {file.name}</AppText> : null}
      {submissionMethod === 'DRIVE_LINK' ? <TextInput accessibilityLabel="Google Drive URL" autoCapitalize="none" onChangeText={onDriveUrl} placeholder="https://drive.google.com/..." placeholderTextColor={colors.muted} style={styles.input} value={driveUrl} /> : null}
    </AppCard>
  );
}

function ReviewCard({ homework, answers, driveUrl, file, submissionMethod, submissionText, submitting, onEdit, onSubmit }: { homework: StudentHomeworkDetail; answers: Record<string, AnswerValue>; driveUrl: string; file: UploadDescriptor | null; submissionMethod?: HomeworkSubmissionMethod; submissionText: string; submitting: boolean; onEdit: () => void; onSubmit: () => void }) {
  const attachment = resolveAttachment({ submissionMethod, driveUrl, file });
  return (
    <AppCard style={styles.questionCard}>
      <AppText style={styles.sectionTitle}>Review submission</AppText>
      {homework.questions.map((question, index) => <Meta key={question.id} label={`Question ${index + 1}`} value={hasHomeworkAnswer(question, answers[question.id]) ? 'Answered' : 'Not answered'} />)}
      {buildSubmissionText(homework.questions, answers, submissionText) ? <Meta label="Written response" value="Included" /> : null}
      {attachment?.method === 'PDF_UPLOAD' ? <Meta label="PDF" value={attachment.file.name} /> : null}
      {attachment?.method === 'DRIVE_LINK' ? <Meta label="Drive link" value={attachment.driveUrl} /> : null}
      {!attachment ? <Meta label="Attachment" value="None" /> : null}
      <View style={styles.actions}>
        <AppButton title="Edit" onPress={onEdit} />
        <AppButton title="Submit homework" loading={submitting} disabled={submitting} onPress={onSubmit} />
      </View>
    </AppCard>
  );
}

function SubmittedCard({ homework, onRefresh }: { homework: StudentHomeworkDetail; onRefresh: () => void }) {
  return (
    <AppCard style={styles.questionCard}>
      <AppText style={styles.sectionTitle}>Submitted</AppText>
      <AppText style={styles.description}>Homework submitted successfully. Grading feedback appears here after your teacher releases it.</AppText>
      {homework.submission?.originalFileName ? <Meta label="File" value={homework.submission.originalFileName} /> : null}
      {homework.submission?.driveUrl ? <Meta label="Drive link" value={homework.submission.driveUrl} /> : null}
      <AppButton title="Refresh" onPress={onRefresh} />
    </AppCard>
  );
}

function ErrorContent({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.center}><ErrorState message={message} /><AppButton title="Retry" onPress={onRetry} /></View>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <View style={styles.meta}><AppText style={styles.metaLabel}>{label}</AppText><AppText style={styles.metaValue}>{value}</AppText></View>;
}

async function readDraft(key: string): Promise<Draft | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? JSON.parse(raw) as Draft : null;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: { flex: 1, gap: spacing.md },
  header: { gap: spacing.sm },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', lineHeight: 34 },
  description: { color: colors.muted, lineHeight: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  summary: { gap: spacing.sm },
  questions: { gap: spacing.md },
  questionCard: { gap: spacing.md },
  questionNumber: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  questionText: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  meta: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  metaLabel: { color: colors.muted, flexShrink: 0, fontSize: 13 },
  metaValue: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  choices: { gap: spacing.sm },
  choice: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.text, lineHeight: 22 },
  choiceTextSelected: { color: '#fff', fontWeight: '700' },
  answerInput: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 120, padding: spacing.md },
  answerInputSmall: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 82, padding: spacing.md },
  input: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 48, padding: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  matchRow: { gap: spacing.sm },
  matchLeft: { fontWeight: '800' },
  matchOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  matchChoice: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  error: { color: colors.danger, lineHeight: 20 },
});
