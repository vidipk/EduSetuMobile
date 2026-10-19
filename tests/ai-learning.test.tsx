import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { studentAiApi } from '@/api/academics/ai-learning';
import { apiClient } from '@/api/client';
import { AppApiError } from '@/api/client/error';
import AiHubScreen from '@/features/ai/AiHubScreen';
import DoubtChatScreen from '@/features/ai/DoubtChatScreen';
import { FlashcardsScreen, PracticeScreen } from '@/features/ai/PracticeScreens';
import RevisionChatScreen from '@/features/ai/RevisionChatScreen';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'student-1', role: 'STUDENT' } }) }));
jest.mock('lucide-react-native', () => ({ Eye: () => null, EyeOff: () => null, Search: () => null }));
jest.mock('@/features/teacher-ops/hooks', () => ({ ...jest.requireActual('@/features/teacher-ops/hooks'), confirmAction: jest.fn(async () => true) }));
jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const http = jest.mocked(apiClient);

const dashboard = (overrides: Record<string, unknown> = {}) => ({
  profile: { id: 'p1', fullName: 'Asha', class: { id: 'c1', name: 'Class 8' }, section: { id: 'sec1', name: 'A' }, academicYear: { id: 'y1', name: '2026-27' } },
  subjects: [{ id: 'math', name: 'Math' }],
  featureAvailability: { studentAiEnabled: true, voiceAiEnabled: true, voiceDoubtAssistantEnabled: true, voiceAvailable: true, voiceDisabledReason: null, remainingVoiceMinutes: 30, monthlyVoiceMinutesLimit: 60, ...overrides },
});

function route(responses: Record<string, unknown>) {
  http.get.mockImplementation(async (path: string) => {
    const key = Object.keys(responses).find((entry) => path.startsWith(entry));
    if (!key) throw new AppApiError('Not found', 404, 'NOT_FOUND');
    const value = responses[key];
    if (value instanceof Error) throw value;
    return { data: value } as never;
  });
}

const courses = { items: [{ id: 'ch1', title: 'Fractions', description: null, subjectId: 'math' }], meta: {} };

beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
});

test('API uses backend paths only and never any provider URL or key', async () => {
  http.post.mockResolvedValue({ data: {} } as never);
  http.get.mockResolvedValue({ data: { items: [] } } as never);
  await studentAiApi.askChapterDoubt({ subjectId: 's', chapterId: 'c', question: 'q' });
  await studentAiApi.startDoubtVoice({ subjectId: 's', chapterId: 'c' });
  await studentAiApi.endVoice('x/y');
  expect(http.post.mock.calls.map(([path]) => path)).toEqual(['/ai/student/chapter-doubt/ask', '/ai/voice/session/create', '/ai/sessions/x%2Fy/end']);
  expect(http.post.mock.calls[1][1]).toMatchObject({ experienceType: 'CHAPTER_DOUBT_VOICE' });
  expect(http.post.mock.calls[2][1]).toMatchObject({ reason: 'USER_ENDED' });
  expect(JSON.stringify([...http.post.mock.calls, ...http.get.mock.calls])).not.toMatch(/openai|sk-|api\.openai/i);
});

test('no avatar mode is ever requested', async () => {
  http.post.mockResolvedValue({ data: {} } as never);
  await studentAiApi.startTextRevision({ subjectId: 's', studyPhase: 'UNIT_I', chapterIds: ['c'] });
  await studentAiApi.startRevisionVoice({ subjectId: 's', studyPhase: 'UNIT_I', chapterIds: ['c'] });
  expect(http.post.mock.calls.map(([, body]) => (body as { mode: string }).mode)).toEqual(['TEXT', 'VOICE']);
});

async function pick(view: Awaited<ReturnType<typeof render>>) {
  await waitFor(() => expect(view.getByText('Math')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('Math')); });
  await waitFor(() => expect(view.getByText('Fractions')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('Fractions')); });
}

test('doubt chat: grounded answer shows sources, ungrounded answer says so, follow-ups keep the conversation', async () => {
  route({ '/students/me/dashboard': dashboard(), '/courses': courses });
  http.post
    .mockResolvedValueOnce({ data: { conversationId: 'conv-1', answer: 'A fraction is a part.', example: '', followUpQuestions: ['What is a numerator?'], practiceSuggestion: '', grounded: true, sourceReferences: [{ sourceId: 's', title: 'Chapter 1 notes', type: 'LESSON', partId: null }], academicContext: {} } } as never)
    .mockResolvedValueOnce({ data: { conversationId: 'conv-1', answer: 'Top number.', example: '', followUpQuestions: [], practiceSuggestion: '', grounded: false, sourceReferences: [], academicContext: {} } } as never);
  const view = await render(<DoubtChatScreen />);
  await pick(view);
  await act(async () => { fireEvent.changeText(view.getByLabelText('Message'), 'What is a fraction?'); });
  await act(async () => { fireEvent.press(view.getByText('Send')); });
  await waitFor(() => expect(view.getByText('A fraction is a part.')).toBeTruthy());
  expect(view.getByText('• Chapter 1 notes')).toBeTruthy();
  await act(async () => { fireEvent.press(view.getByLabelText('Ask: What is a numerator?')); });
  await waitFor(() => expect(view.getByText('Top number.')).toBeTruthy());
  expect(view.getByText('This answer is not based on your school material.')).toBeTruthy();
  expect(http.post.mock.calls[1][1]).toMatchObject({ conversationId: 'conv-1', chapterId: 'ch1', question: 'What is a numerator?' });
});

test('doubt chat: a failed request removes the question, shows the backend quota message and can retry', async () => {
  route({ '/students/me/dashboard': dashboard(), '/courses': courses });
  http.post
    .mockRejectedValueOnce(new AppApiError('Daily AI limit reached', 429, 'AI_QUOTA'))
    .mockResolvedValueOnce({ data: { conversationId: 'c', answer: 'Here you go.', example: '', followUpQuestions: [], practiceSuggestion: '', grounded: false, sourceReferences: [], academicContext: {} } } as never);
  const view = await render(<DoubtChatScreen />);
  await pick(view);
  await act(async () => { fireEvent.changeText(view.getByLabelText('Message'), 'Help'); });
  await act(async () => { fireEvent.press(view.getByText('Send')); });
  await waitFor(() => expect(view.getByText('Daily AI limit reached')).toBeTruthy());
  expect(view.queryByLabelText('You: Help')).toBeNull();
  await act(async () => { fireEvent.press(view.getByText('Retry')); });
  await waitFor(() => expect(view.getByText('Here you go.')).toBeTruthy());
  expect(http.post).toHaveBeenCalledTimes(2);
});

test('doubt chat: school-disabled AI blocks asking', async () => {
  route({ '/students/me/dashboard': dashboard({ studentAiEnabled: false }), '/courses': courses });
  const view = await render(<DoubtChatScreen />);
  await waitFor(() => expect(view.getByText('Ask AI chat is not enabled for students by your school.')).toBeTruthy());
  expect(view.getByLabelText('Message').props.editable).toBe(false);
});

const revisionConfig = (capabilities: Record<string, unknown> = {}) => ({
  studentClass: { id: 'c1', name: 'Class 8' }, studentSection: { id: 'sec1', name: 'A' }, subjects: [{ id: 'math', name: 'Math' }],
  availableStudyPhases: [{ value: 'UNIT_I', label: 'Unit I' }],
  capabilities: { text: { available: true, disabledReason: null }, voice: { available: true, disabledReason: null }, avatar: { available: false, disabledReason: 'x' }, ...capabilities },
});

test('revision chat: choose phase and chapters, start, then reply with follow-up', async () => {
  route({
    '/ai/student/revision/config': revisionConfig(),
    '/ai/student/revision/sessions/active': { active: false, session: null },
    '/ai/student/revision/chapters': { subjectId: 'math', studyPhase: 'UNIT_I', source: 'CONFIGURED', chapters: [{ id: 'ch1', name: 'Fractions', selectedByDefault: true }, { id: 'ch2', name: 'Decimals', selectedByDefault: false }] },
  });
  http.post
    .mockResolvedValueOnce({ data: { sessionId: 'rs1', mode: 'TEXT', subjectId: 'math', subjectName: 'Math', studyPhase: 'UNIT_I', studyPhaseLabel: 'Unit I', chapters: [{ id: 'ch1', name: 'Fractions' }], messages: [{ role: 'assistant', text: 'Let us revise Fractions.' }], keyPoints: ['Numerator on top'] } } as never)
    .mockResolvedValueOnce({ data: { sessionId: 'rs1', reply: 'Correct!', followUpQuestions: [] } } as never);
  const view = await render(<RevisionChatScreen />);
  await waitFor(() => expect(view.getByText('Math')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('Math')); });
  await act(async () => { fireEvent.press(view.getByText('Unit I')); });
  await waitFor(() => expect(view.getByLabelText('Chapter Fractions')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('Start revision chat')); });
  await waitFor(() => expect(view.getByText('Let us revise Fractions.')).toBeTruthy());
  expect(http.post.mock.calls[0]).toEqual(['/ai/student/revision/sessions', { subjectId: 'math', studyPhase: 'UNIT_I', chapterIds: ['ch1'], mode: 'TEXT' }, expect.anything()]);
  expect(view.getByText('• Numerator on top')).toBeTruthy();
  await act(async () => { fireEvent.changeText(view.getByLabelText('Message'), 'Numerator is the top number'); });
  await act(async () => { fireEvent.press(view.getByText('Send')); });
  await waitFor(() => expect(view.getByText('Correct!')).toBeTruthy());
});

test('revision chat: an unfinished text session can be resumed with its history', async () => {
  route({
    '/ai/student/revision/config': revisionConfig(),
    '/ai/student/revision/sessions/active': { active: true, session: { sessionId: 'rs9', mode: 'TEXT', aiSessionId: null, conversationId: 'c', subjectId: 'math', subjectName: 'Math', studyPhase: 'UNIT_I', studyPhaseLabel: 'Unit I', startedAt: '2026-10-01T00:00:00.000Z', chapters: [{ id: 'ch1', name: 'Fractions' }], messages: [{ role: 'assistant', text: 'Welcome back' }] } },
  });
  const view = await render(<RevisionChatScreen />);
  await waitFor(() => expect(view.getByText('You have an unfinished revision session')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('Resume session')); });
  expect(view.getByText('Welcome back')).toBeTruthy();
});

test('revision chat: text capability disabled by the backend shows its reason and blocks start', async () => {
  route({
    '/ai/student/revision/config': revisionConfig({ text: { available: false, disabledReason: 'Revision is not enabled for your class.' } }),
    '/ai/student/revision/sessions/active': { active: false, session: null },
  });
  const view = await render(<RevisionChatScreen />);
  await waitFor(() => expect(view.getByText('Revision is not enabled for your class.')).toBeTruthy());
  expect(view.getByText('Start revision chat')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Start revision chat' })).toBeDisabled();
});

test('practice questions are practice only and make no grading request', async () => {
  route({ '/students/me/dashboard': dashboard(), '/courses': courses });
  http.post.mockResolvedValueOnce({ data: { conversationId: 'g1', title: 'Practice', questions: [{ question: 'What is 1/2 + 1/2?', options: ['1', '2'], answer: '1', explanation: 'Same denominator', difficulty: 'easy' }] } } as never);
  const view = await render(<PracticeScreen />);
  expect(view.getByText(/Nothing here is graded/)).toBeTruthy();
  await pick(view);
  await act(async () => { fireEvent.press(view.getByText('Generate questions')); });
  await waitFor(() => expect(view.getByText(/What is 1\/2 \+ 1\/2\?/)).toBeTruthy());
  expect(http.post.mock.calls[0][0]).toBe('/ai/student/practice-questions/generate');
  expect(http.post.mock.calls[0][1]).toMatchObject({ classId: 'c1', sectionId: 'sec1', subjectId: 'math', chapter: 'Fractions', questionType: 'mcq' });
  await act(async () => { fireEvent.press(view.getByText('Show answer')); });
  expect(view.getByText('Answer: 1')).toBeTruthy();
  expect(http.post).toHaveBeenCalledTimes(1);
});

test('flashcards flip between question and answer', async () => {
  route({ '/students/me/dashboard': dashboard(), '/courses': courses });
  http.post.mockResolvedValueOnce({ data: { conversationId: 'f1', title: 'Cards', flashcards: [{ front: 'Define fraction', back: 'Part of a whole', hint: 'Pizza', difficulty: 'easy' }] } } as never);
  const view = await render(<FlashcardsScreen />);
  await pick(view);
  await act(async () => { fireEvent.press(view.getByText('Generate flashcards')); });
  await waitFor(() => expect(view.getByText('Define fraction')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('Define fraction')); });
  expect(view.getByText('Part of a whole')).toBeTruthy();
});

test('hub: shows backend disabled reasons and offers no avatar option', async () => {
  route({
    '/students/me/dashboard': dashboard({ voiceAvailable: false, voiceDisabledReason: 'Voice minutes used up this month.', flashcardsEnabled: false }),
    '/ai/student/revision/config': revisionConfig({ voice: { available: false, disabledReason: 'Voice revision is off for your school.' } }),
  });
  const view = await render(<AiHubScreen />);
  await waitFor(() => expect(view.getByText('Voice minutes used up this month.')).toBeTruthy());
  await waitFor(() => expect(view.getByText('Voice revision is off for your school.')).toBeTruthy());
  expect(view.queryByText(/avatar/i)).toBeNull();
  expect(view.getByText('Practice questions')).toBeTruthy();
  expect(view.getByText('Flashcards is not enabled by your school.')).toBeTruthy();
});
