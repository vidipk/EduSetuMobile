import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { homeworkApi } from '@/api/academics/teacher-ops';
import type { HomeworkDetail, HomeworkListItem, HomeworkStatus, HomeworkSubmissionRecord } from '@/api/contracts/teacher-ops';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppText, EmptyState } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { Chips, ErrorPanel, Notice, Row, Section } from '@/features/performance/components';
import { isUncertainOutcome } from '@/features/performance/format';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { openSubmissionPdf } from './submission-files';

import { confirmAction, useAction, useLoadMore, useTeacherProfile } from './hooks';
import {
  HOMEWORK_QUESTION_TYPES,
  activeAssignments,
  buildHomeworkRequest,
  changeQuestionType,
  displayDate,
  displayDateTime,
  homeworkDraftErrors,
  homeworkTotalMarks,
  inferHomeworkType,
  newQuestionDraft,
  questionErrors,
  sectionScopes,
  statusLabel,
  toNumber,
  trimNumber,
  todayString,
  validateMarks,
  type HomeworkDraft,
  type QuestionDraft,
} from './logic';
import { AddQuestionRow, QuestionEditor } from './QuestionEditor';
import { BackButton, ButtonRow, ErrorList, Field, FormScroll, Heading, SkeletonList, StatusBadge } from './ui';

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

// ------------------------------------------------------------------- list

const STATUS_FILTERS: { id: 'ALL' | HomeworkStatus; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Drafts' },
  { id: 'PUBLISHED', label: 'Published' },
  { id: 'CLOSED', label: 'Closed' },
];

export function HomeworkListScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ classId?: string; sectionId?: string }>();
  const profile = useTeacherProfile();
  const scopes = useMemo(() => sectionScopes(activeAssignments(profile.data)), [profile.data]);
  const initial = scopes.find((scope) => scope.classId === param(params.classId) && scope.sectionId === param(params.sectionId));
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'ALL' | HomeworkStatus>('ALL');
  const [search, setSearch] = useState('');
  const activeScopeKey = scopeKey ?? initial?.key ?? 'all';
  const scope = scopes.find((entry) => entry.key === activeScopeKey) ?? null;
  const key = user && profile.data ? `hw-list:${user.id}:${scope?.key ?? 'all'}:${status}` : null;
  const query = (page: number) => ({ page, limit: 20, classId: scope?.classId, sectionId: scope?.sectionId, status: status === 'ALL' ? undefined : status });
  const first = useRemoteData(key, () => homeworkApi.list(query(1)));
  const list = useLoadMore(first.data, (page) => homeworkApi.list(query(page)));
  const needle = search.trim().toLowerCase();
  const shown = needle ? list.items.filter((item) => item.title.toLowerCase().includes(needle)) : list.items;

  return (
    <FormScroll refreshing={first.refreshing} onRefresh={() => void first.refresh()}>
      <BackButton />
      <Heading title="Homework" subtitle="Homework you created for your assigned classes." />
      <AppButton title="Create homework" onPress={() => router.push('/assignments/create')} />
      <Chips label="Section" options={[{ id: 'all', label: 'All sections' }, ...scopes.map((entry) => ({ id: entry.key, label: entry.label }))]} value={activeScopeKey} onChange={setScopeKey} />
      <Chips label="Status" options={STATUS_FILTERS} value={status} onChange={setStatus} />
      <Field label="Search loaded homework by title" value={search} onChangeText={setSearch} autoCapitalize="none" />
      {first.error ? <ErrorPanel error={first.error} onRetry={first.reload} /> : null}
      {first.loading ? <SkeletonList /> : null}
      {first.data ? <AppText style={styles.muted}>Showing {shown.length} of {list.total} homework</AppText> : null}
      {first.data && shown.length === 0 ? <EmptyState title="No homework" detail={needle ? 'No loaded homework matches your search.' : 'Create homework to get started.'} /> : null}
      {shown.map((item) => <HomeworkCard key={item.id} item={item} />)}
      {list.error ? <ErrorPanel error={list.error} onRetry={() => void list.loadMore()} /> : null}
      {list.hasMore ? <AppButton title="Load more homework" loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
    </FormScroll>
  );
}

function HomeworkCard({ item }: { item: HomeworkListItem }) {
  const total = toNumber(item.totalMarks);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${statusLabel(item.status)}`} onPress={() => router.push({ pathname: '/assignments/[homeworkId]', params: { homeworkId: item.id } })}>
      <AppCard style={styles.cardGap}>
        <View style={styles.rowBetween}>
          <AppText style={styles.title}>{item.title}</AppText>
          <StatusBadge status={item.status} />
        </View>
        <AppText style={styles.muted}>{item.subject.name} · {item.class.name} {item.section.name}</AppText>
        <AppText style={styles.muted}>Due {displayDate(item.dueDate)}{total !== null ? ` · ${trimNumber(total)} marks` : ''}</AppText>
        {item.status !== 'DRAFT' ? <AppText style={styles.muted}>{item._count.submissions} {item._count.submissions === 1 ? 'submission' : 'submissions'}</AppText> : null}
      </AppCard>
    </Pressable>
  );
}

// ------------------------------------------------------------ create / edit

const SUPPORTED = new Set(HOMEWORK_QUESTION_TYPES.map((type) => type.id));

function detailToDraft(detail: HomeworkDetail, scopes: ReturnType<typeof sectionScopes>): { draft: HomeworkDraft; unsupported: boolean } {
  const scope = scopes.find((entry) => entry.classId === detail.classId && entry.sectionId === detail.sectionId);
  let unsupported = false;
  const questions: QuestionDraft[] = detail.questions.map((question) => {
    if (!SUPPORTED.has(question.type)) unsupported = true;
    const base = newQuestionDraft(SUPPORTED.has(question.type) ? question.type : 'SHORT_ANSWER');
    const options = (question.options ?? []).map((option) => ({ id: option.id, text: option.text ?? option.label ?? '' }));
    const answer = question.correctAnswer;
    return {
      ...base,
      text: question.questionText,
      marks: trimNumber(Number(question.marks)),
      options: question.type === 'MCQ' ? options : [],
      correctOptionId: question.type === 'MCQ' && typeof answer === 'string' ? answer : '',
      correctBool: question.type === 'TRUE_FALSE' ? (answer === true || answer === 'true' ? true : answer === false || answer === 'false' ? false : null) : null,
      correctText: (question.type === 'ONE_WORD_ANSWER' || question.type === 'FILL_IN_THE_BLANK') && typeof answer === 'string' ? answer : '',
    };
  });
  return {
    unsupported,
    draft: { title: detail.title, description: detail.description ?? '', instructions: detail.instructions ?? '', scopeKey: scope?.key ?? '', subjectId: detail.subjectId, dueDate: detail.dueDate.slice(0, 10), totalMarks: trimNumber(toNumber(detail.totalMarks) ?? 0), questions },
  };
}

const EMPTY_DRAFT: HomeworkDraft = { title: '', description: '', instructions: '', scopeKey: '', subjectId: '', dueDate: '', totalMarks: '', questions: [] };

export function HomeworkFormScreen() {
  const params = useLocalSearchParams<{ homeworkId?: string }>();
  const editId = param(params.homeworkId);
  const profile = useTeacherProfile();
  const scopes = useMemo(() => sectionScopes(activeAssignments(profile.data)), [profile.data]);
  const existing = useRemoteData(editId ? `hw-edit:${editId}` : null, () => homeworkApi.get(editId));
  return (
    <FormScroll>
      <BackButton />
      <Heading title={editId ? 'Edit homework' : 'Create homework'} />
      {profile.loading || existing.loading ? <SkeletonList /> : null}
      {profile.error ? <ErrorPanel error={profile.error} onRetry={profile.reload} /> : null}
      {existing.error ? <ErrorPanel error={existing.error} onRetry={existing.reload} /> : null}
      {profile.data && scopes.length === 0 ? <EmptyState title="No class assignments" detail="You need a class and subject assignment to create homework." /> : null}
      {profile.data && scopes.length > 0 && (!editId || existing.data) ? <HomeworkForm scopes={scopes} detail={existing.data} editId={editId} /> : null}
    </FormScroll>
  );
}

function HomeworkForm({ scopes, detail, editId }: { scopes: ReturnType<typeof sectionScopes>; detail: HomeworkDetail | null; editId: string }) {
  const converted = useMemo(() => (detail ? detailToDraft(detail, scopes) : null), [detail, scopes]);
  const [draft, setDraft] = useState<HomeworkDraft>(() => converted?.draft ?? { ...EMPTY_DRAFT, scopeKey: scopes[0]?.key ?? '', subjectId: scopes[0]?.subjects.length === 1 ? scopes[0].subjects[0].id : '', dueDate: todayString() });
  const [showErrors, setShowErrors] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(editId || null);
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();
  const scope = scopes.find((entry) => entry.key === draft.scopeKey) ?? null;
  const readOnly = Boolean(detail && detail.status !== 'DRAFT');
  const errors = homeworkDraftErrors(draft, { requireFutureDue: !editId, forPublish: true });
  const draftErrors = homeworkDraftErrors(draft, { requireFutureDue: !editId, forPublish: false });
  const type = inferHomeworkType(draft.questions);

  const update = (patch: Partial<HomeworkDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateQuestion = (index: number, next: QuestionDraft) => update({ questions: draft.questions.map((question, i) => (i === index ? next : question)) });

  const save = async (publish: boolean) => {
    setShowErrors(true);
    const blocking = publish ? errors : draftErrors;
    if (blocking.length || !scope) return;
    const body = buildHomeworkRequest(draft, scope);
    const result = await action.run(async () => {
      // Reuse the id once the record exists so a retry never creates a duplicate.
      let id = savedId;
      if (id) await homeworkApi.update(id, body);
      else id = (await homeworkApi.create(body)).id;
      setSavedId(id);
      if (publish) await homeworkApi.publish(id);
      return id;
    }, publish ? () => confirmAction('Publish homework?', 'Students in this section will see it immediately.', 'Publish') : undefined);
    if (!result) return;
    if (result.ok) {
      setNotice(publish ? 'Homework published.' : 'Draft saved.');
      router.replace({ pathname: '/assignments/[homeworkId]', params: { homeworkId: result.value } });
    }
  };

  if (readOnly) return <Notice tone="warning">Published homework cannot be edited here. Open it to review submissions.</Notice>;
  return (
    <>
      {converted?.unsupported ? <Notice tone="warning">This homework contains question types that cannot be edited on mobile. Editing here would change them to short answers; use the web dashboard instead.</Notice> : null}
      <Field label="Title" value={draft.title} onChangeText={(title) => update({ title })} maxLength={255} />
      <Field label="Description (optional)" value={draft.description} onChangeText={(description) => update({ description })} multiline />
      <Field label="Instructions (optional)" value={draft.instructions} onChangeText={(instructions) => update({ instructions })} multiline />
      <Chips label="Section" options={scopes.map((entry) => ({ id: entry.key, label: entry.label }))} value={draft.scopeKey} onChange={(key) => update({ scopeKey: key, subjectId: scopes.find((entry) => entry.key === key)?.subjects.length === 1 ? (scopes.find((entry) => entry.key === key)?.subjects[0].id ?? '') : '' })} />
      {scope ? <Chips label="Subject" options={scope.subjects.map((subject) => ({ id: subject.id, label: subject.name }))} value={draft.subjectId} onChange={(subjectId) => update({ subjectId })} /> : null}
      <Field label="Due date (YYYY-MM-DD)" value={draft.dueDate} onChangeText={(dueDate) => update({ dueDate: dueDate.trim() })} autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} hint="Due at the end of the day." />
      {draft.questions.length === 0 ? <Field label="Total marks" value={draft.totalMarks} onChangeText={(totalMarks) => update({ totalMarks })} keyboardType="decimal-pad" maxLength={7} hint="Required when there are no questions." /> : null}

      <Section title={`Questions (${draft.questions.length})`}>
        <AppText style={styles.muted}>Type: {statusLabel(type)} · Total {trimNumber(homeworkTotalMarks(draft))} marks</AppText>
        {draft.questions.map((question, index) => (
          <QuestionEditor
            key={question.key}
            index={index}
            question={question}
            types={HOMEWORK_QUESTION_TYPES}
            showCorrectText
            errors={showErrors ? questionErrors(question, true) : []}
            onChange={(next) => updateQuestion(index, next)}
            onChangeType={(nextType) => updateQuestion(index, changeQuestionType(question, nextType as QuestionDraft['type']))}
            onRemove={() => update({ questions: draft.questions.filter((_, i) => i !== index) })}
          />
        ))}
        <AddQuestionRow types={HOMEWORK_QUESTION_TYPES} onAdd={(nextType) => update({ questions: [...draft.questions, newQuestionDraft(nextType as QuestionDraft['type'])] })} />
      </Section>

      {showErrors ? <ErrorList errors={errors} /> : null}
      {notice ? <Notice>{notice}</Notice> : null}
      {action.error ? <ErrorPanel error={action.error} onRetry={action.clearError} /> : null}
      {savedId && !editId && action.error ? <Notice tone="warning">The homework was saved as a draft. Saving again will update that draft, not create another.</Notice> : null}
      <ButtonRow>
        <AppButton title="Save draft" loading={action.busy} disabled={action.busy} onPress={() => void save(false)} />
        <AppButton title="Save & publish" loading={action.busy} disabled={action.busy} onPress={() => void save(true)} />
      </ButtonRow>
    </>
  );
}

// ------------------------------------------------------------------ detail

export function HomeworkDetailScreen() {
  const params = useLocalSearchParams<{ homeworkId: string }>();
  const homeworkId = param(params.homeworkId);
  const detail = useRemoteData(homeworkId ? `hw-detail:${homeworkId}` : null, () => homeworkApi.get(homeworkId));
  const data = detail.data;
  const action = useAction();
  const [notice, setNotice] = useState<string | null>(null);

  const publish = async () => {
    if (!data) return;
    const result = await action.run(() => homeworkApi.publish(data.id), () => confirmAction('Publish homework?', 'Students in this section will see it immediately.', 'Publish'));
    if (!result) return;
    if (result.ok) { setNotice('Homework published.'); detail.reload(); } else if (isUncertainOutcome(result.error)) detail.reload();
  };
  const remove = async () => {
    if (!data) return;
    const result = await action.run(() => homeworkApi.remove(data.id), () => confirmAction('Delete this draft?', 'This permanently deletes the draft homework.', 'Delete', true));
    if (result?.ok) router.replace('/assignments');
    else if (result && isUncertainOutcome(result.error)) detail.reload();
  };

  return (
    <FormScroll refreshing={detail.refreshing} onRefresh={() => void detail.refresh()}>
      <BackButton />
      {detail.loading ? <SkeletonList /> : null}
      {detail.error ? <ErrorPanel error={detail.error.notFound || detail.error.forbidden ? { ...detail.error, message: 'This homework is not available to you.' } : detail.error} onRetry={detail.reload} /> : null}
      {notice ? <Notice>{notice}</Notice> : null}
      {action.error ? <ErrorPanel error={action.error} onRetry={action.clearError} /> : null}
      {data ? (
        <>
          <Heading title={data.title} subtitle={`${data.subject.name} · ${data.class.name} ${data.section.name}`} />
          <View style={styles.rowBetween}><StatusBadge status={data.status} /><AppText style={styles.muted}>Due {displayDate(data.dueDate)}</AppText></View>
          <AppCard style={styles.cardGap}>
            <Row label="Type" value={statusLabel(data.homeworkType)} />
            <Row label="Total marks" value={toNumber(data.totalMarks) === null ? 'Not set' : trimNumber(toNumber(data.totalMarks) as number)} />
            <Row label="Questions" value={String(data.questions.length)} />
            {data.description ? <AppText>{data.description}</AppText> : null}
            {data.instructions ? <AppText style={styles.muted}>{data.instructions}</AppText> : null}
          </AppCard>
          {data.status === 'DRAFT' ? (
            <ButtonRow>
              <AppButton title="Edit" onPress={() => router.push({ pathname: '/assignments/create', params: { homeworkId: data.id } })} />
              <AppButton title="Publish" loading={action.busy} disabled={action.busy} onPress={() => void publish()} />
              <AppButton title="Delete draft" disabled={action.busy} onPress={() => void remove()} />
            </ButtonRow>
          ) : null}
          <Section title="Questions (teacher view with answer key)">
            {data.questions.length === 0 ? <AppText style={styles.muted}>No structured questions. Students answer in writing.</AppText> : data.questions.map((question) => (
              <AppCard key={question.id} style={styles.cardGap}>
                <AppText style={styles.title}>{question.order}. {question.questionText}</AppText>
                <AppText style={styles.muted}>{statusLabel(question.type)} · {trimNumber(Number(question.marks))} marks</AppText>
                {question.correctAnswer !== null && question.correctAnswer !== undefined && typeof question.correctAnswer !== 'object' ? <AppText style={styles.muted}>Answer key: {answerKeyText(question)}</AppText> : null}
              </AppCard>
            ))}
          </Section>
          {data.status !== 'DRAFT' ? <SubmissionsPanel homework={data} /> : null}
        </>
      ) : null}
    </FormScroll>
  );
}

function answerKeyText(question: HomeworkDetail['questions'][number]) {
  if (question.type === 'MCQ') {
    const option = (question.options ?? []).find((entry) => entry.id === question.correctAnswer);
    return option ? (option.text ?? option.label ?? String(question.correctAnswer)) : String(question.correctAnswer);
  }
  if (question.type === 'TRUE_FALSE') return question.correctAnswer === true || question.correctAnswer === 'true' ? 'True' : 'False';
  return String(question.correctAnswer);
}

const PAGE = 15;

function SubmissionsPanel({ homework }: { homework: HomeworkDetail }) {
  const subs = useRemoteData(`hw-subs:${homework.id}`, () => homeworkApi.submissions(homework.id));
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'GRADED'>('ALL');
  const [visible, setVisible] = useState(PAGE);
  const max = toNumber(homework.totalMarks);
  const all = (subs.data ?? []).filter((submission) => submission.status !== 'DRAFT' && submission.submittedAt);
  const pending = all.filter((submission) => submission.status !== 'GRADED' && submission.status !== 'RETURNED');
  const graded = all.filter((submission) => submission.status === 'GRADED' || submission.status === 'RETURNED');
  const list = filter === 'ALL' ? all : filter === 'PENDING' ? pending : graded;

  return (
    <Section title="Student submissions">
      {subs.loading ? <SkeletonList rows={2} /> : null}
      {subs.error ? <ErrorPanel error={subs.error} onRetry={subs.reload} /> : null}
      {subs.data ? (
        <>
          <AppText style={styles.muted}>{all.length} submitted · {pending.length} need grading · {graded.length} graded</AppText>
          {max === null || max <= 0 ? <Notice tone="warning">This homework has no maximum marks set, so grades cannot be range-checked.</Notice> : null}
          <Chips label="Submissions" options={[{ id: 'ALL', label: `All (${all.length})` }, { id: 'PENDING', label: `Need grading (${pending.length})` }, { id: 'GRADED', label: `Graded (${graded.length})` }]} value={filter} onChange={(next) => { setFilter(next as typeof filter); setVisible(PAGE); }} />
          {list.length === 0 ? <EmptyState title="No submissions" detail={filter === 'PENDING' ? 'Nothing is waiting to be graded.' : 'No students have submitted yet.'} /> : null}
          {list.slice(0, visible).map((submission) => <SubmissionCard key={submission.id} submission={submission} max={max} homeworkType={homework.homeworkType} onChanged={() => void subs.refresh()} />)}
          {list.length > visible ? <AppButton title={`Show more (${list.length - visible} left)`} onPress={() => setVisible(visible + PAGE)} /> : null}
        </>
      ) : null}
    </Section>
  );
}

function isGoogleLink(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com');
  } catch {
    return false;
  }
}

function SubmissionCard({ submission, max, homeworkType, onChanged }: { submission: HomeworkSubmissionRecord; max: number | null; homeworkType: string; onChanged: () => void }) {
  const finalized = submission.status === 'GRADED' || submission.status === 'RETURNED';
  const current = toNumber(submission.marks);
  const [marks, setMarks] = useState(current === null ? '' : trimNumber(current));
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const objective = toNumber(submission.objectiveScore);

  const save = async () => {
    const parsed = validateMarks(marks, max);
    if (!parsed.ok) return setFieldError(parsed.error);
    setFieldError(null);
    const result = await action.run(
      () => homeworkApi.grade(submission.id, { marks: parsed.value, feedback: feedback.trim() || undefined }),
      finalized ? () => confirmAction('Replace the existing grade?', `This submission is already graded${current !== null ? ` (${trimNumber(current)})` : ''}. Replace it with ${trimNumber(parsed.value)}?`, 'Replace', true) : undefined,
    );
    if (!result) return;
    if (result.ok) { setSaved(true); onChanged(); } else if (isUncertainOutcome(result.error)) onChanged();
  };

  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <AppText style={styles.title}>{submission.student.user.fullName}</AppText>
          {submission.student.rollNumber ? <AppText style={styles.muted}>Roll {submission.student.rollNumber}</AppText> : null}
        </View>
        <StatusBadge status={finalized ? 'GRADED' : submission.status} label={finalized ? 'Graded' : submission.status === 'LATE' ? 'Needs grading · late' : 'Needs grading'} />
      </View>
      <AppText style={styles.muted}>Submitted {displayDateTime(submission.submittedAt)}</AppText>
      {submission.submissionText ? <AppText accessibilityLabel="Written answer" style={styles.answer}>{submission.submissionText}</AppText> : null}
      {submission.driveUrl ? (isGoogleLink(submission.driveUrl) ? <AppButton title="Open Google Drive link" onPress={() => void Linking.openURL(submission.driveUrl as string)} /> : <AppText style={styles.muted}>Drive link (not a Google Drive address): {submission.driveUrl}</AppText>) : null}
      {submission.originalFileName ? <PdfRow submissionId={submission.id} fileName={submission.originalFileName} /> : null}
      {!submission.submissionText && !submission.driveUrl && !submission.originalFileName ? <AppText style={styles.muted}>No written answer or attachment was included.</AppText> : null}
      {objective !== null ? <AppText style={styles.muted}>Auto-scored objective questions: {trimNumber(objective)}{homeworkType === 'MIXED' ? ' (objective part only)' : ''}</AppText> : null}
      {homeworkType !== 'SUBJECTIVE' ? <AnswerDetails submissionId={submission.id} /> : null}
      {finalized && current !== null ? <AppText style={styles.title}>Marks: {trimNumber(current)}{max !== null ? ` / ${trimNumber(max)}` : ''}</AppText> : null}

      <Field label={`Marks for ${submission.student.user.fullName}${max !== null ? ` (max ${trimNumber(max)})` : ''}`} value={marks} onChangeText={(value) => { setMarks(value); setFieldError(null); setSaved(false); }} keyboardType="decimal-pad" maxLength={7} error={fieldError} />
      <Field label={`Feedback for ${submission.student.user.fullName}`} value={feedback} onChangeText={(value) => { setFeedback(value); setSaved(false); }} multiline />
      {action.error ? <ErrorPanel error={action.error} onRetry={action.clearError} /> : null}
      {saved ? <Notice>Grade saved.</Notice> : null}
      <AppButton title={finalized ? 'Update grade' : 'Save grade'} loading={action.busy} disabled={action.busy} onPress={() => void save()} />
    </AppCard>
  );
}

function PdfRow({ submissionId, fileName }: { submissionId: string; fileName: string }) {
  const action = useAction();
  return (
    <View style={styles.cardGap}>
      <AppText style={styles.muted}>PDF attached: {fileName}</AppText>
      <AppButton title="Open PDF" loading={action.busy} disabled={action.busy} onPress={() => void action.run(() => openSubmissionPdf(submissionId))} />
      <AppText style={styles.hint}>Opens your phone&apos;s share sheet so you can pick a PDF viewer.</AppText>
      {action.error ? <ErrorPanel error={action.error} onRetry={action.clearError} /> : null}
    </View>
  );
}

function AnswerDetails({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const detail = useRemoteData(open ? `hw-sub-detail:${submissionId}` : null, () => homeworkApi.submissionDetail(submissionId));
  return (
    <View style={styles.cardGap}>
      <AppButton title={open ? 'Hide question answers' : 'Show question answers'} onPress={() => setOpen(!open)} />
      {open && detail.loading ? <SkeletonList rows={1} /> : null}
      {open && detail.error ? <ErrorPanel error={detail.error} onRetry={detail.reload} /> : null}
      {open && detail.data ? (
        detail.data.answers.length === 0 ? <AppText style={styles.muted}>No per-question answers were recorded for this submission.</AppText> : detail.data.answers.map((answer) => (
          <View key={answer.questionId} accessible accessibilityLabel={`Question ${answer.order} answer`} style={styles.answerRow}>
            <AppText style={styles.title}>{answer.order}. {answer.questionText}</AppText>
            <AppText>Student answered: {answer.answerText ?? 'No answer'}</AppText>
            {answer.expectedAnswer ? <AppText style={styles.muted}>Expected: {answer.expectedAnswer}</AppText> : null}
            <AppText style={answer.isCorrect === false ? styles.warn : styles.muted}>
              {answer.autoGraded ? `${answer.isCorrect ? 'Correct' : 'Incorrect'} · auto-graded ${trimNumber(answer.awardedMarks ?? 0)} / ${trimNumber(answer.maxMarks)}` : `${trimNumber(answer.maxMarks)} marks · graded by you`}
            </AppText>
          </View>
        ))
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12 },
  warn: { color: '#8A5A16', fontWeight: '700' },
  answerRow: { backgroundColor: '#F2F6F5', borderRadius: 8, gap: 2, padding: spacing.md },
  cardGap: { gap: spacing.sm },
  title: { flexShrink: 1, fontSize: 17, fontWeight: '700' },
  muted: { color: colors.muted, lineHeight: 20 },
  answer: { backgroundColor: '#F2F6F5', borderRadius: 8, lineHeight: 22, padding: spacing.md },
  rowBetween: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  flex: { flex: 1 },
});
