import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import StudentHomeworkDetailScreen from '@/app/(student)/homework/[homeworkId]';
import { buildSubmitPayload, validateHomework } from '@/app/(student)/homework-submission';
import { studentWorkApi } from '@/api/academics/student-work';
import { AppApiError } from '@/api/client/error';
import type { StudentHomeworkDetail } from '@/api/contracts/student-work';
import { pickDocument } from '@/files/uploads';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ homeworkId: 'hw-1' }),
  useFocusEffect: () => undefined,
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1', organizationId: 'org-1' } }) }));

jest.mock('@/files/uploads', () => ({
  pickDocument: jest.fn(),
  createMultipartFile: (file: { uri: string; name: string; mimeType: string }) => ({ uri: file.uri, name: file.name, type: file.mimeType }),
}));

jest.mock('lucide-react-native', () => ({ Eye: () => null, EyeOff: () => null, Search: () => null }));

jest.mock('@/api/academics/student-work', () => ({
  studentWorkApi: { getHomework: jest.fn(), submitHomework: jest.fn() },
}));

const api = jest.mocked(studentWorkApi);
const mockedPick = jest.mocked(pickDocument);
const mockedStore = jest.mocked(SecureStore);

const base: StudentHomeworkDetail = {
  id: 'hw-1',
  title: 'Physics Homework',
  subject: { id: 's1', name: 'Physics' },
  homeworkType: 'SUBJECTIVE',
  totalMarks: 10,
  dueDate: '2026-12-01T00:00:00.000Z',
  description: null,
  instructions: null,
  class: { id: 'c1', name: '8' },
  section: { id: 'sec1', name: 'A' },
  legacyContent: null,
  submission: null,
  questions: [{ id: 'q1', type: 'LONG_ANSWER', questionText: 'Explain mass versus weight', description: null, marks: 10, order: 1, required: true }],
};

const mixed: StudentHomeworkDetail = {
  ...base,
  homeworkType: 'MIXED',
  questions: [
    { id: 'q0', type: 'MCQ', questionText: 'Unit of force?', description: null, marks: 2, order: 1, required: true, options: [{ id: 'a', text: 'Newton' }, { id: 'b', text: 'Joule' }] },
    { id: 'q1', type: 'LONG_ANSWER', questionText: 'Explain mass versus weight', description: null, marks: 8, order: 2, required: false },
  ],
};

const objective: StudentHomeworkDetail = { ...mixed, homeworkType: 'OBJECTIVE', questions: [mixed.questions[0]] };

const submittedRecord = (): StudentHomeworkDetail => ({
  ...base,
  submission: { id: 'sub', status: 'SUBMITTED', submissionMethod: null, driveUrl: null, fileUrl: null, originalFileName: null, objectiveScore: null, submittedAt: '2026-10-14T10:00:00.000Z', answers: [] },
});

beforeEach(() => {
  api.getHomework.mockReset();
  api.submitHomework.mockReset();
  mockedPick.mockReset();
  mockedStore.deleteItemAsync.mockClear();
});

async function open(homework: StudentHomeworkDetail) {
  api.getHomework.mockResolvedValue(homework);
  const view = await render(<StudentHomeworkDetailScreen />);
  await waitFor(() => expect(view.getByText(homework.title)).toBeTruthy());
  return view;
}

const submit = async (view: Awaited<ReturnType<typeof open>>) => {
  await fireEvent.press(view.getByRole('button', { name: 'Review submission' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Submit homework' })).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Submit homework' }));
};

test('submits text-only subjective homework without PDF or Drive', async () => {
  const view = await open(base);
  api.submitHomework.mockResolvedValue(null);
  api.getHomework.mockResolvedValue(submittedRecord());
  await fireEvent.changeText(view.getByLabelText('Answer question 1'), 'Weight is a force.');
  await submit(view);

  await waitFor(() => expect(api.submitHomework).toHaveBeenCalledTimes(1));
  const [id, payload] = api.submitHomework.mock.calls[0];
  expect(id).toBe('hw-1');
  expect(payload).toEqual({
    objectiveAnswers: [],
    submissionText: 'Explain mass versus weight\nWeight is a force.',
    submissionMethod: undefined,
    driveUrl: undefined,
    file: undefined,
  });
  await waitFor(() => expect(view.getByText(/submitted successfully/i)).toBeTruthy());
});

test('draft is deleted after a confirmed submission', async () => {
  const view = await open(base);
  api.submitHomework.mockResolvedValue(null);
  api.getHomework.mockResolvedValue(submittedRecord());
  await fireEvent.changeText(view.getByLabelText('Answer question 1'), 'text');
  await submit(view);
  await waitFor(() => expect(view.getByText(/submitted successfully/i)).toBeTruthy());
  expect(mockedStore.deleteItemAsync).toHaveBeenCalledWith('edusetu.homework-draft.org-1.u1.hw-1');
});

test('rejects an empty subjective submission before calling the API', async () => {
  const view = await open({ ...base, questions: [{ ...base.questions[0], required: false }] });
  await fireEvent.press(view.getByRole('button', { name: 'Review submission' }));
  await fireEvent.press(await view.findByRole('button', { name: 'Submit homework' }));
  await waitFor(() => expect(view.getByText(/write your response, attach a PDF/i)).toBeTruthy());
  expect(api.submitHomework).not.toHaveBeenCalled();
});

test('keeps required-answer validation', async () => {
  const view = await open(base);
  await fireEvent.press(view.getByRole('button', { name: 'Review submission' }));
  await fireEvent.press(await view.findByRole('button', { name: 'Submit homework' }));
  await waitFor(() => expect(view.getByText('Please answer Question 1.')).toBeTruthy());
  expect(api.submitHomework).not.toHaveBeenCalled();
});

test('shows a backend error clearly and keeps the form editable', async () => {
  const view = await open(base);
  api.submitHomework.mockRejectedValue(new AppApiError('Homework is closed.', 400));
  await fireEvent.changeText(view.getByLabelText('Answer question 1'), 'text');
  await submit(view);
  await waitFor(() => expect(view.getByText('Homework is closed.')).toBeTruthy());
  expect(view.queryByText(/\{|\[object/)).toBeNull();
  expect(mockedStore.deleteItemAsync).not.toHaveBeenCalled();
});

test('reconciles server state after an uncertain network result', async () => {
  const view = await open(base);
  api.submitHomework.mockRejectedValue(new AppApiError('Network Error'));
  api.getHomework.mockResolvedValue(submittedRecord());
  await fireEvent.changeText(view.getByLabelText('Answer question 1'), 'text');
  await submit(view);
  await waitFor(() => expect(view.getByText(/submitted successfully/i)).toBeTruthy());
  expect(api.getHomework).toHaveBeenCalledTimes(2);
  expect(mockedStore.deleteItemAsync).toHaveBeenCalled();
});

test('uncertain result that was not recorded tells the student it is safe to retry', async () => {
  const view = await open(base);
  api.submitHomework.mockRejectedValue(new AppApiError('Network Error'));
  await fireEvent.changeText(view.getByLabelText('Answer question 1'), 'text');
  await submit(view);
  await waitFor(() => expect(view.getByText(/safe to try again/i)).toBeTruthy());
  expect(mockedStore.deleteItemAsync).not.toHaveBeenCalled();
});

test('session expiry keeps the draft and prompts sign-in', async () => {
  const view = await open(base);
  api.submitHomework.mockRejectedValue(new AppApiError('Unauthorized', 401));
  await fireEvent.changeText(view.getByLabelText('Answer question 1'), 'text');
  await submit(view);
  await waitFor(() => expect(view.getByText(/session has expired/i)).toBeTruthy());
  expect(mockedStore.deleteItemAsync).not.toHaveBeenCalled();
});

test('previously submitted homework shows the submitted state and no form', async () => {
  const view = await open(submittedRecord());
  expect(view.getByText(/submitted successfully/i)).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Review submission' })).toBeNull();
  expect(api.submitHomework).not.toHaveBeenCalled();
});

test('submits a PDF with PDF_UPLOAD', async () => {
  const view = await open(base);
  mockedPick.mockResolvedValue({ uri: 'file:///a.pdf', name: 'a.pdf', mimeType: 'application/pdf', size: 1000 });
  api.submitHomework.mockResolvedValue(null);
  api.getHomework.mockResolvedValue(submittedRecord());
  await fireEvent.changeText(view.getByLabelText('Answer question 1'), 'text');
  await fireEvent.press(view.getByRole('button', { name: 'Choose PDF' }));
  await waitFor(() => expect(view.getByText('Selected PDF: a.pdf')).toBeTruthy());
  await submit(view);
  await waitFor(() => expect(api.submitHomework).toHaveBeenCalled());
  expect(api.submitHomework.mock.calls[0][1]).toMatchObject({ submissionMethod: 'PDF_UPLOAD', file: { uri: 'file:///a.pdf', name: 'a.pdf', type: 'application/pdf' } });
});

test('submits a Drive link with DRIVE_LINK and rejects non-Google links', async () => {
  const view = await open(base);
  api.submitHomework.mockResolvedValue(null);
  api.getHomework.mockResolvedValue(submittedRecord());
  await fireEvent.changeText(view.getByLabelText('Answer question 1'), 'text');
  await fireEvent.press(view.getByRole('button', { name: 'Drive link' }));
  await fireEvent.changeText(view.getByLabelText('Google Drive URL'), 'https://example.com/x');
  await fireEvent.press(view.getByRole('button', { name: 'Review submission' }));
  await fireEvent.press(await view.findByRole('button', { name: 'Submit homework' }));
  await waitFor(() => expect(view.getByText(/Only Google Drive or Google Docs/)).toBeTruthy());
  expect(api.submitHomework).not.toHaveBeenCalled();

  await fireEvent.changeText(view.getByLabelText('Google Drive URL'), 'https://drive.google.com/file/d/1');
  await submit(view);
  await waitFor(() => expect(api.submitHomework).toHaveBeenCalled());
  expect(api.submitHomework.mock.calls[0][1]).toMatchObject({ submissionMethod: 'DRIVE_LINK', driveUrl: 'https://drive.google.com/file/d/1' });
});

describe('payload and validation rules', () => {
  test('mixed homework sends written text together with objective answers', () => {
    const inputs = { answers: { q0: 'a', q1: 'Mass is matter.' } };
    expect(validateHomework(mixed, inputs)).toBeNull();
    expect(buildSubmitPayload(mixed, inputs)).toMatchObject({
      objectiveAnswers: [{ questionId: 'q0', type: 'MCQ', selectedOptionId: 'a' }],
      submissionText: 'Explain mass versus weight\nMass is matter.',
      submissionMethod: undefined,
    });
  });

  test('mixed homework with only objective answers is rejected', () => {
    expect(validateHomework(mixed, { answers: { q0: 'a' } })).toMatch(/write your response/i);
  });

  test('objective-only homework needs no text or attachment', () => {
    expect(validateHomework(objective, { answers: { q0: 'b' } })).toBeNull();
    expect(buildSubmitPayload(objective, { answers: { q0: 'b' } })).toEqual({
      objectiveAnswers: [{ questionId: 'q0', type: 'MCQ', selectedOptionId: 'b' }],
      submissionText: undefined,
      submissionMethod: undefined,
      driveUrl: undefined,
      file: undefined,
    });
  });

  test('a method chosen without content is not sent', () => {
    const inputs = { answers: { q0: 'a', q1: 'text' }, submissionMethod: 'DRIVE_LINK' as const, driveUrl: '  ' };
    expect(validateHomework(mixed, inputs)).toBeNull();
    expect(buildSubmitPayload(mixed, inputs).submissionMethod).toBeUndefined();
  });

  test('overlong written text is rejected client-side', () => {
    expect(validateHomework(base, { answers: { q1: 'x'.repeat(10001) } })).toMatch(/too long/i);
  });
});
