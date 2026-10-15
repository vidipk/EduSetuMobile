import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { quizApi } from '@/api/academics/teacher-ops';
import type { AttemptGradingStatus, QuizAttemptReview, QuizAttemptRow, QuizDetail, QuizListItem, QuizReviewAnswer, QuizStatus, TeacherQuizQuestion } from '@/api/contracts/teacher-ops';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppText, EmptyState } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { Chips, ErrorPanel, Notice, Row, Section } from '@/features/performance/components';
import { isUncertainOutcome } from '@/features/performance/format';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { confirmAction, useAction, useLoadMore, useTeacherProfile } from './hooks';
import {
  QUIZ_QUESTION_TYPES,
  activeAssignments,
  buildCreateQuizRequest,
  buildQuizQuestionInput,
  changeQuizQuestionType,
  displayDateTime,
  newQuizQuestionDraft,
  nextOrderIndex,
  quizFormErrors,
  quizPublishBlockers,
  quizQuestionErrors,
  quizQuestionToDraft,
  quizSumMarks,
  sectionScopes,
  statusLabel,
  toNumber,
  trimNumber,
  validateMarks,
  type QuizFormInput,
  type QuizQuestionDraft,
} from './logic';
import { AddQuestionRow, QuestionEditor } from './QuestionEditor';
import { BackButton, ButtonRow, ErrorList, Field, FormScroll, Heading, SkeletonList, StatusBadge } from './ui';

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

// -------------------------------------------------------------------- list

const STATUS_FILTERS: { id: 'ALL' | QuizStatus; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Drafts' },
  { id: 'PUBLISHED', label: 'Published' },
  { id: 'CLOSED', label: 'Closed' },
];

export function QuizListScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ classId?: string; sectionId?: string }>();
  const profile = useTeacherProfile();
  const scopes = useMemo(() => sectionScopes(activeAssignments(profile.data)), [profile.data]);
  const initial = scopes.find((scope) => scope.classId === param(params.classId) && scope.sectionId === param(params.sectionId));
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'ALL' | QuizStatus>('ALL');
  const [search, setSearch] = useState('');
  const activeKey = scopeKey ?? initial?.key ?? 'all';
  const scope = scopes.find((entry) => entry.key === activeKey) ?? null;
  const key = user && profile.data ? `quiz-list:${user.id}:${scope?.key ?? 'all'}:${status}` : null;
  const query = (page: number) => ({ page, limit: 20, classId: scope?.classId, sectionId: scope?.sectionId, status: status === 'ALL' ? undefined : status });
  const first = useRemoteData(key, () => quizApi.list(query(1)));
  const list = useLoadMore(first.data, (page) => quizApi.list(query(page)));
  const needle = search.trim().toLowerCase();
  const shown = needle ? list.items.filter((item) => item.title.toLowerCase().includes(needle)) : list.items;

  return (
    <FormScroll refreshing={first.refreshing} onRefresh={() => void first.refresh()}>
      <BackButton />
      <Heading title="Quizzes" subtitle="Quizzes you created for your assigned classes." />
      <AppButton title="Create quiz" onPress={() => router.push('/quizzes/create')} />
      <Chips label="Section" options={[{ id: 'all', label: 'All sections' }, ...scopes.map((entry) => ({ id: entry.key, label: entry.label }))]} value={activeKey} onChange={setScopeKey} />
      <Chips label="Status" options={STATUS_FILTERS} value={status} onChange={setStatus} />
      <Field label="Search loaded quizzes by title" value={search} onChangeText={setSearch} autoCapitalize="none" />
      {first.error ? <ErrorPanel error={first.error} onRetry={first.reload} /> : null}
      {first.loading ? <SkeletonList /> : null}
      {first.data ? <AppText style={styles.muted}>Showing {shown.length} of {list.total} quizzes</AppText> : null}
      {first.data && shown.length === 0 ? <EmptyState title="No quizzes" detail={needle ? 'No loaded quiz matches your search.' : 'Create a quiz to get started.'} /> : null}
      {shown.map((item) => <QuizCard key={item.id} item={item} />)}
      {list.error ? <ErrorPanel error={list.error} onRetry={() => void list.loadMore()} /> : null}
      {list.hasMore ? <AppButton title="Load more quizzes" loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
    </FormScroll>
  );
}

function QuizCard({ item }: { item: QuizListItem }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${statusLabel(item.status)}`} onPress={() => router.push({ pathname: '/quizzes/[quizId]', params: { quizId: item.id } })}>
      <AppCard style={styles.cardGap}>
        <View style={styles.rowBetween}>
          <AppText style={styles.title}>{item.title}</AppText>
          <StatusBadge status={item.status} />
        </View>
        <AppText style={styles.muted}>{item.subject?.name} · {item.class?.name} {item.section?.name}</AppText>
        <AppText style={styles.muted}>{item.questionCount} questions · {trimNumber(Number(item.totalMarks))} marks · {item.durationMinutes} min</AppText>
        {item.status !== 'DRAFT' ? <AppText style={styles.muted}>{item._count.attempts} {item._count.attempts === 1 ? 'attempt' : 'attempts'}</AppText> : null}
      </AppCard>
    </Pressable>
  );
}

// ------------------------------------------------------------------ create

export function QuizCreateScreen() {
  const profile = useTeacherProfile();
  const scopes = useMemo(() => sectionScopes(activeAssignments(profile.data)), [profile.data]);
  return (
    <FormScroll>
      <BackButton />
      <Heading title="Create quiz" subtitle="Create the quiz first, then add questions and publish." />
      {profile.loading ? <SkeletonList rows={2} /> : null}
      {profile.error ? <ErrorPanel error={profile.error} onRetry={profile.reload} /> : null}
      {profile.data && scopes.length === 0 ? <EmptyState title="No class assignments" detail="You need a class and subject assignment to create a quiz." /> : null}
      {profile.data && scopes.length > 0 ? <QuizCreateForm scopes={scopes} /> : null}
    </FormScroll>
  );
}

function QuizCreateForm({ scopes }: { scopes: ReturnType<typeof sectionScopes> }) {
  const [form, setForm] = useState<QuizFormInput>({ title: '', description: '', scopeKey: scopes[0]?.key ?? '', subjectId: scopes[0]?.subjects.length === 1 ? scopes[0].subjects[0].id : '', totalMarks: '', durationMinutes: '30' });
  const [showErrors, setShowErrors] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const action = useAction();
  const scope = scopes.find((entry) => entry.key === form.scopeKey) ?? null;
  const errors = quizFormErrors(form);
  const set = (patch: Partial<QuizFormInput>) => setForm((current) => ({ ...current, ...patch }));

  const create = async () => {
    setShowErrors(true);
    if (errors.length || !scope) return;
    if (createdId) return router.replace({ pathname: '/quizzes/[quizId]', params: { quizId: createdId } });
    const result = await action.run(() => quizApi.create(buildCreateQuizRequest(form, scope)));
    if (result?.ok) {
      setCreatedId(result.value.id);
      router.replace({ pathname: '/quizzes/[quizId]', params: { quizId: result.value.id } });
    }
  };

  return (
    <>
      <Field label="Title" value={form.title} onChangeText={(title) => set({ title })} />
      <Field label="Instructions (optional)" value={form.description} onChangeText={(description) => set({ description })} multiline />
      <Chips label="Section" options={scopes.map((entry) => ({ id: entry.key, label: entry.label }))} value={form.scopeKey} onChange={(scopeKey) => set({ scopeKey, subjectId: scopes.find((entry) => entry.key === scopeKey)?.subjects.length === 1 ? (scopes.find((entry) => entry.key === scopeKey)?.subjects[0].id ?? '') : '' })} />
      {scope ? <Chips label="Subject" options={scope.subjects.map((subject) => ({ id: subject.id, label: subject.name }))} value={form.subjectId} onChange={(subjectId) => set({ subjectId })} /> : null}
      <Field label="Total marks" value={form.totalMarks} onChangeText={(totalMarks) => set({ totalMarks })} keyboardType="decimal-pad" maxLength={7} hint="Must equal the sum of question marks before you can publish." />
      <Field label="Duration (minutes)" value={form.durationMinutes} onChangeText={(durationMinutes) => set({ durationMinutes })} keyboardType="number-pad" maxLength={3} />
      {showErrors ? <ErrorList errors={errors} /> : null}
      {action.error ? <ErrorPanel error={action.error} onRetry={action.clearError} /> : null}
      <AppButton title="Create quiz" loading={action.busy} disabled={action.busy} onPress={() => void create()} />
    </>
  );
}

// ------------------------------------------------------------------ manage

type Editing = { questionId: string | null; draft: QuizQuestionDraft };

export function QuizManageScreen() {
  const params = useLocalSearchParams<{ quizId: string }>();
  const quizId = param(params.quizId);
  const detail = useRemoteData(quizId ? `quiz-detail:${quizId}` : null, () => quizApi.get(quizId));
  const data = detail.data;
  const action = useAction();
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const blockers = data ? quizPublishBlockers(data) : [];
  const isDraft = data?.status === 'DRAFT';

  const saveQuestion = async () => {
    if (!data || !editing) return;
    setShowErrors(true);
    if (quizQuestionErrors(editing.draft).length) return;
    const input = buildQuizQuestionInput(editing.draft, editing.questionId ? (data.questions.find((question) => question.id === editing.questionId)?.orderIndex ?? nextOrderIndex(data)) : nextOrderIndex(data));
    const result = await action.run(() => (editing.questionId ? quizApi.updateQuestion(editing.questionId, input) : quizApi.addQuestion(data.id, input)));
    if (!result) return;
    if (result.ok) { setEditing(null); setShowErrors(false); setNotice('Question saved.'); detail.reload(); } else if (isUncertainOutcome(result.error)) detail.reload();
  };
  const removeQuestion = async (question: TeacherQuizQuestion) => {
    const result = await action.run(() => quizApi.removeQuestion(question.id), () => confirmAction('Remove this question?', 'The question is deleted from the draft quiz.', 'Remove', true));
    if (!result) return;
    if (result.ok) { setNotice('Question removed.'); detail.reload(); } else if (isUncertainOutcome(result.error)) detail.reload();
  };
  const fixTotal = async () => {
    if (!data) return;
    const result = await action.run(() => quizApi.update(data.id, { totalMarks: quizSumMarks(data) }));
    if (result?.ok) { setNotice('Total marks updated to match the questions.'); detail.reload(); }
  };
  const publish = async () => {
    if (!data || blockers.length) return;
    const result = await action.run(() => quizApi.publish(data.id), () => confirmAction('Publish quiz?', 'Students will see it immediately. Questions can no longer be edited here once published.', 'Publish'));
    if (!result) return;
    if (result.ok) { setNotice('Quiz published.'); detail.reload(); } else if (isUncertainOutcome(result.error)) detail.reload();
  };
  const remove = async () => {
    if (!data) return;
    const result = await action.run(() => quizApi.remove(data.id), () => confirmAction('Delete this draft quiz?', 'This permanently deletes the draft quiz and its questions.', 'Delete', true));
    if (result?.ok) router.replace('/quizzes');
    else if (result && isUncertainOutcome(result.error)) detail.reload();
  };

  return (
    <FormScroll refreshing={detail.refreshing} onRefresh={() => void detail.refresh()}>
      <BackButton />
      {detail.loading ? <SkeletonList /> : null}
      {detail.error ? <ErrorPanel error={detail.error.notFound || detail.error.forbidden ? { ...detail.error, message: 'This quiz is not available to you.' } : detail.error} onRetry={detail.reload} /> : null}
      {notice ? <Notice>{notice}</Notice> : null}
      {action.error ? <ErrorPanel error={action.error} onRetry={action.clearError} /> : null}
      {data ? (
        <>
          <Heading title={data.title} subtitle={`${data.subject.name} · ${data.class.name} ${data.section.name}`} />
          <StatusBadge status={data.status} />
          <AppCard style={styles.cardGap}>
            <Row label="Total marks" value={toNumber(data.totalMarks) === null ? 'Not set' : trimNumber(toNumber(data.totalMarks) as number)} />
            <Row label="Sum of question marks" value={trimNumber(quizSumMarks(data))} />
            <Row label="Duration" value={`${data.durationMinutes} minutes`} />
            <Row label="Questions" value={String(data.questions.length)} />
            {data.description ? <AppText style={styles.muted}>{data.description}</AppText> : null}
          </AppCard>

          {isDraft ? (
            <>
              {blockers.length ? <View><AppText style={styles.title}>Before you can publish</AppText><ErrorList errors={blockers} /></View> : <Notice>This quiz is ready to publish.</Notice>}
              <ButtonRow>
                {data.questions.length > 0 && blockers.some((message) => message.startsWith('Total marks')) ? <AppButton title={`Set total to ${trimNumber(quizSumMarks(data))}`} disabled={action.busy} onPress={() => void fixTotal()} /> : null}
                <AppButton title="Publish quiz" loading={action.busy} disabled={action.busy || blockers.length > 0} onPress={() => void publish()} />
                <AppButton title="Delete draft" disabled={action.busy} onPress={() => void remove()} />
              </ButtonRow>
            </>
          ) : <Notice>Published quizzes are locked so student attempts stay valid.</Notice>}

          <Section title={`Questions (${data.questions.length})`}>
            {data.questions.length === 0 ? <AppText style={styles.muted}>No questions yet.</AppText> : null}
            {data.questions.map((question) => (
              <AppCard key={question.id} style={styles.cardGap}>
                <AppText style={styles.title}>{question.orderIndex}. {question.questionText}</AppText>
                <AppText style={styles.muted}>{statusLabel(question.questionType)} · {trimNumber(Number(question.marks))} marks</AppText>
                {(question.options ?? []).map((option) => <AppText key={option.id} style={styles.muted}>{String(question.correctAnswer) === option.id ? '✓ ' : '• '}{option.label ?? option.text}</AppText>)}
                {question.questionType === 'TRUE_FALSE' ? <AppText style={styles.muted}>Answer: {question.correctAnswer === true || question.correctAnswer === 'true' ? 'True' : 'False'}</AppText> : null}
                {isDraft ? (
                  <ButtonRow>
                    <AppButton title="Edit" accessibilityLabel={`Edit question ${question.orderIndex}`} disabled={action.busy} onPress={() => { setEditing({ questionId: question.id, draft: quizQuestionToDraft(question) }); setShowErrors(false); }} />
                    <AppButton title="Remove" accessibilityLabel={`Remove question ${question.orderIndex}`} disabled={action.busy} onPress={() => void removeQuestion(question)} />
                  </ButtonRow>
                ) : null}
              </AppCard>
            ))}
            {isDraft && !editing ? <AddQuestionRow types={QUIZ_QUESTION_TYPES} onAdd={(type) => { setEditing({ questionId: null, draft: newQuizQuestionDraft(type as QuizQuestionDraft['type']) }); setShowErrors(false); setNotice(null); }} /> : null}
            {isDraft && editing ? (
              <View style={styles.cardGap}>
                <QuestionEditor
                  index={editing.questionId ? Math.max(0, data.questions.findIndex((question) => question.id === editing.questionId)) : data.questions.length}
                  question={editing.draft}
                  types={QUIZ_QUESTION_TYPES}
                  errors={showErrors ? quizQuestionErrors(editing.draft) : []}
                  onChange={(draft) => setEditing({ ...editing, draft })}
                  onChangeType={(type) => setEditing({ ...editing, draft: changeQuizQuestionType(editing.draft, type as QuizQuestionDraft['type']) })}
                />
                <ButtonRow>
                  <AppButton title="Save question" loading={action.busy} disabled={action.busy} onPress={() => void saveQuestion()} />
                  <AppButton title="Cancel" disabled={action.busy} onPress={() => { setEditing(null); setShowErrors(false); }} />
                </ButtonRow>
              </View>
            ) : null}
          </Section>

          {data.status !== 'DRAFT' ? <AttemptsPanel quiz={data} /> : null}
        </>
      ) : null}
    </FormScroll>
  );
}

// --------------------------------------------------------------- attempts

const GRADING_FILTERS: { id: 'ALL' | AttemptGradingStatus; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING_REVIEW', label: 'Needs review' },
  { id: 'PARTIALLY_GRADED', label: 'Partly graded' },
  { id: 'GRADED', label: 'Graded' },
];

function AttemptsPanel({ quiz }: { quiz: QuizDetail }) {
  const [filter, setFilter] = useState<'ALL' | AttemptGradingStatus>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const key = `quiz-attempts:${quiz.id}:${filter}:${search}`;
  const query = (page: number) => ({ page, limit: 20, gradingStatus: filter === 'ALL' ? undefined : filter, studentSearch: search || undefined });
  const first = useRemoteData(key, () => quizApi.attempts(quiz.id, query(1)));
  const list = useLoadMore(first.data, (page) => quizApi.attempts(quiz.id, query(page)));

  return (
    <Section title="Student attempts">
      <Chips label="Evaluation" options={GRADING_FILTERS} value={filter} onChange={setFilter} />
      <Field label="Search student (name, roll or admission no.)" value={searchInput} onChangeText={setSearchInput} autoCapitalize="none" />
      <AppButton title="Search" onPress={() => setSearch(searchInput.trim())} />
      {first.loading ? <SkeletonList rows={2} /> : null}
      {first.error ? <ErrorPanel error={first.error} onRetry={first.reload} /> : null}
      {first.data ? <AppText style={styles.muted}>Showing {list.items.length} of {list.total} attempts</AppText> : null}
      {first.data && list.items.length === 0 ? <EmptyState title="No attempts" detail="No student attempts match these filters." /> : null}
      {list.items.map((attempt) => <AttemptRow key={attempt.id} attempt={attempt} />)}
      {list.error ? <ErrorPanel error={list.error} onRetry={() => void list.loadMore()} /> : null}
      {list.hasMore ? <AppButton title="Load more attempts" loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
    </Section>
  );
}

function AttemptRow({ attempt }: { attempt: QuizAttemptRow }) {
  const inProgress = attempt.status === 'IN_PROGRESS';
  const score = attempt.gradingStatus === 'GRADED' ? attempt.finalScore : null;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: inProgress }} accessibilityLabel={`${attempt.student.fullName}, ${inProgress ? 'in progress' : statusLabel(attempt.gradingStatus)}`} disabled={inProgress} onPress={() => router.push({ pathname: '/quizzes/attempt/[attemptId]', params: { attemptId: attempt.id } })}>
      <AppCard style={styles.cardGap}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <AppText style={styles.title}>{attempt.student.fullName}</AppText>
            {attempt.student.rollNumber ? <AppText style={styles.muted}>Roll {attempt.student.rollNumber}</AppText> : null}
          </View>
          <StatusBadge status={inProgress ? 'IN_PROGRESS' : attempt.gradingStatus} label={inProgress ? 'In progress' : attempt.gradingStatus === 'NOT_REQUIRED' ? 'Auto-graded' : statusLabel(attempt.gradingStatus)} />
        </View>
        <AppText style={styles.muted}>{inProgress ? 'Not submitted yet; it cannot be graded.' : `Submitted ${displayDateTime(attempt.submittedAt)}`}</AppText>
        {score !== null && attempt.maxScore !== null ? <AppText style={styles.title}>Score {trimNumber(score)} / {trimNumber(attempt.maxScore)}</AppText> : null}
        {!inProgress && attempt.needsReviewCount > 0 ? <AppText style={styles.warn}>{attempt.needsReviewCount} {attempt.needsReviewCount === 1 ? 'answer needs' : 'answers need'} grading</AppText> : null}
      </AppCard>
    </Pressable>
  );
}

// ------------------------------------------------------------------ review

export function QuizAttemptReviewScreen() {
  const params = useLocalSearchParams<{ attemptId: string }>();
  const attemptId = param(params.attemptId);
  const review = useRemoteData(attemptId ? `quiz-review:${attemptId}` : null, () => quizApi.review(attemptId));
  return (
    <FormScroll refreshing={review.refreshing} onRefresh={() => void review.refresh()}>
      <BackButton />
      {review.loading ? <SkeletonList /> : null}
      {review.error ? <ErrorPanel error={review.error.notFound || review.error.forbidden ? { ...review.error, message: 'This attempt is not available to you.' } : review.error} onRetry={review.reload} /> : null}
      {review.data ? <ReviewBody review={review.data} onChanged={() => void review.refresh()} /> : null}
    </FormScroll>
  );
}

function ReviewBody({ review, onChanged }: { review: QuizAttemptReview; onChanged: () => void }) {
  const { attempt } = review;
  const finalized = attempt.gradingStatus === 'GRADED';
  const submitted = attempt.status !== 'IN_PROGRESS';
  const canGrade = submitted && !finalized;
  const subjective = review.answers.filter((answer) => answer.needsManualReview);
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(subjective.map((answer) => [answer.answerId, answer.teacherAwardedMarks === null ? '' : trimNumber(answer.teacherAwardedMarks)])));
  const [feedback, setFeedback] = useState<Record<string, string>>(() => Object.fromEntries(subjective.map((answer) => [answer.answerId, answer.teacherFeedback ?? ''])));
  const [overall, setOverall] = useState(attempt.overallFeedback ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();

  const collect = (requireAll: boolean) => {
    const nextErrors: Record<string, string> = {};
    const patches: { answerId: string; awardedMarks: number; feedback?: string }[] = [];
    for (const answer of subjective) {
      const text = marks[answer.answerId] ?? '';
      if (!text.trim()) {
        if (requireAll) nextErrors[answer.answerId] = 'Enter marks before finalizing.';
        continue;
      }
      const parsed = validateMarks(text, answer.maxMarks);
      if (!parsed.ok) nextErrors[answer.answerId] = parsed.error;
      else patches.push({ answerId: answer.answerId, awardedMarks: parsed.value, feedback: feedback[answer.answerId]?.trim() || undefined });
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length ? null : patches;
  };

  // The backend finalizes and releases an attempt as soon as every subjective answer has marks,
  // even when "finalize" is false. Detect that here so the teacher is never surprised.
  const save = async (finalize: boolean) => {
    const patches = collect(finalize);
    if (!patches) return;
    if (!finalize && patches.length === 0) return setNotice('Enter marks for at least one answer to save progress.');
    const gradedIds = new Set(patches.map((patch) => patch.answerId));
    const coversEverything = subjective.length > 0 && subjective.every((answer) => gradedIds.has(answer.answerId));
    const willFinalize = finalize || coversEverything;
    const result = await action.run(
      () => quizApi.grade(attempt.id, { answers: patches, overallFeedback: overall.trim() || undefined, finalize }),
      willFinalize ? () => confirmAction('Finalize evaluation?', 'Every answer now has marks, so saving finalizes the result and releases it to the student. It can no longer be changed.', 'Finalize') : undefined,
    );
    if (!result) return;
    if (result.ok) { setNotice(willFinalize ? 'Evaluation finalized and released.' : 'Progress saved. Some answers still need marks.'); onChanged(); } else if (isUncertainOutcome(result.error)) onChanged();
  };

  return (
    <>
      <Heading title={review.student.fullName} subtitle={`${review.quiz.title}${review.student.rollNumber ? ` · Roll ${review.student.rollNumber}` : ''}`} />
      <View style={styles.rowBetween}>
        <StatusBadge status={submitted ? attempt.gradingStatus : 'IN_PROGRESS'} label={!submitted ? 'In progress' : attempt.gradingStatus === 'NOT_REQUIRED' ? 'Auto-graded' : statusLabel(attempt.gradingStatus)} />
        <AppText style={styles.muted}>Submitted {displayDateTime(attempt.submittedAt)}</AppText>
      </View>
      <AppCard style={styles.cardGap}>
        <Row label="Auto-graded marks" value={attempt.autoScore === null ? '—' : trimNumber(attempt.autoScore)} />
        <Row label="Final score" value={finalized && attempt.finalScore !== null ? `${trimNumber(attempt.finalScore)} / ${trimNumber(attempt.maxScore ?? review.quiz.totalMarks)}` : 'Not finalized'} />
        {finalized && attempt.percentage !== null ? <Row label="Percentage" value={`${trimNumber(attempt.percentage)}%`} /> : null}
        <Row label="Answers needing grading" value={String(attempt.needsReviewCount)} />
      </AppCard>
      {!submitted ? <Notice tone="warning">This attempt has not been submitted, so it cannot be graded.</Notice> : null}
      {finalized ? <Notice>This evaluation is finalized and read-only.</Notice> : null}
      {notice ? <Notice>{notice}</Notice> : null}
      {action.error ? <ErrorPanel error={action.error} onRetry={action.clearError} /> : null}

      {review.answers.map((answer) => (
        <AnswerCard key={answer.answerId} answer={answer} canGrade={canGrade} marks={marks[answer.answerId] ?? ''} feedback={feedback[answer.answerId] ?? ''} error={errors[answer.answerId] ?? null} onMarks={(value) => { setMarks((current) => ({ ...current, [answer.answerId]: value })); setNotice(null); }} onFeedback={(value) => setFeedback((current) => ({ ...current, [answer.answerId]: value }))} />
      ))}

      {canGrade ? (
        <>
          <Field label="Overall feedback (optional)" value={overall} onChangeText={setOverall} multiline hint="Saving marks for every written answer finalizes and releases the result." />
          <ButtonRow>
            <AppButton title="Save progress" loading={action.busy} disabled={action.busy} onPress={() => void save(false)} />
            <AppButton title="Finalize evaluation" loading={action.busy} disabled={action.busy} onPress={() => void save(true)} />
          </ButtonRow>
        </>
      ) : attempt.overallFeedback ? <AppText style={styles.muted}>Feedback: {attempt.overallFeedback}</AppText> : null}
    </>
  );
}

function answerText(value: unknown, options: QuizReviewAnswer['options']) {
  if (value === null || value === undefined || value === '') return 'No answer';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  const option = options.find((entry) => entry.id === value);
  return option ? (option.label ?? option.text ?? String(value)) : String(value);
}

function AnswerCard({ answer, canGrade, marks, feedback, error, onMarks, onFeedback }: { answer: QuizReviewAnswer; canGrade: boolean; marks: string; feedback: string; error: string | null; onMarks: (value: string) => void; onFeedback: (value: string) => void }) {
  const manual = answer.needsManualReview;
  return (
    <AppCard style={styles.cardGap}>
      <AppText style={styles.title}>{answer.questionNumber}. {answer.questionText}</AppText>
      <AppText style={styles.muted}>{statusLabel(answer.questionType)} · {trimNumber(answer.maxMarks)} marks</AppText>
      <AppText accessibilityLabel={`Student answer to question ${answer.questionNumber}`} style={styles.answer}>{answerText(answer.submittedAnswer, answer.options)}</AppText>
      {!manual ? (
        <>
          <AppText style={styles.muted}>Correct answer: {answerText(answer.expectedAnswer, answer.options)}</AppText>
          <AppText style={answer.isCorrect ? styles.good : styles.warn}>{answer.isCorrect ? 'Correct' : 'Incorrect'} · auto-graded {answer.finalAwardedMarks === null ? '' : trimNumber(answer.finalAwardedMarks)} / {trimNumber(answer.maxMarks)}</AppText>
        </>
      ) : canGrade ? (
        <>
          <Field label={`Marks for question ${answer.questionNumber} (max ${trimNumber(answer.maxMarks)})`} value={marks} onChangeText={onMarks} keyboardType="decimal-pad" maxLength={7} error={error} />
          <Field label={`Feedback for question ${answer.questionNumber}`} value={feedback} onChangeText={onFeedback} multiline />
        </>
      ) : (
        <>
          <AppText style={styles.title}>Marks: {answer.finalAwardedMarks === null ? 'Not graded' : `${trimNumber(answer.finalAwardedMarks)} / ${trimNumber(answer.maxMarks)}`}</AppText>
          {answer.teacherFeedback ? <AppText style={styles.muted}>Feedback: {answer.teacherFeedback}</AppText> : null}
        </>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  cardGap: { gap: spacing.sm },
  title: { flexShrink: 1, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.muted, lineHeight: 20 },
  warn: { color: '#8A5A16', fontWeight: '700' },
  good: { color: colors.success, fontWeight: '700' },
  answer: { backgroundColor: '#F2F6F5', borderRadius: 8, lineHeight: 22, padding: spacing.md },
  rowBetween: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  flex: { flex: 1 },
});
