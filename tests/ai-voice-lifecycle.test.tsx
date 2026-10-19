// Mocked LiveKit lifecycle tests. These prove the state machine, cleanup and no-duplicate-dispatch rules.
// They do NOT prove real microphone capture or audio playback: that needs a device or the Node media harness.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PermissionsAndroid, Platform } from 'react-native';

import { studentAiApi } from '@/api/academics/ai-learning';
import type { VoiceSessionStart } from '@/api/contracts/ai-learning';
import { AGENT_JOIN_TIMEOUT_MS, useVoiceSession } from '@/features/ai/voice/use-voice-session';

import { FakeRoom } from './fixtures/fake-livekit';

jest.mock('livekit-client', () => ({
  Room: jest.requireActual('./fixtures/fake-livekit').FakeRoom,
  RoomEvent: { ParticipantConnected: 'pc', ParticipantDisconnected: 'pd', Reconnecting: 'rc', Reconnected: 'rcd', Disconnected: 'dc' },
  ParticipantKind: { AGENT: 4 },
}));
jest.mock('@livekit/react-native', () => ({
  registerGlobals: jest.fn(),
  AudioSession: { startAudioSession: jest.fn(async () => undefined), stopAudioSession: jest.fn(async () => undefined) },
}));
jest.mock('@/api/academics/ai-learning', () => ({
  studentAiApi: { voiceSession: jest.fn(), endVoice: jest.fn() },
}));

const api = jest.mocked(studentAiApi);
const AGENT = { kind: 4 };

const session = (overrides: Partial<VoiceSessionStart> = {}): VoiceSessionStart => ({
  sessionId: 'sess-1', status: 'ACTIVE', roomName: 'room-1', participantToken: 'jwt', livekitUrl: 'wss://lk.test',
  expiresAt: new Date(Date.now() + 600_000).toISOString(), maxSessionSeconds: 600, remainingMonthlySeconds: 3000, initialGreeting: 'Hi!', ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  FakeRoom.last = null;
  FakeRoom.instances = 0;
  FakeRoom.failConnect = false;
  api.voiceSession.mockReset();
  api.endVoice.mockReset();
  api.voiceSession.mockResolvedValue({ sessionId: 'sess-1', status: 'ACTIVE', experienceType: 'CHAPTER_DOUBT_VOICE', initialGreeting: null, summary: null, runtimeState: { agentState: 'listening', userState: null, lastProviderError: null }, messages: [] });
  api.endVoice.mockResolvedValue({ sessionId: 'sess-1', status: 'ENDED', summary: 'Done' });
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

test('happy path: permission, session, connect, agent joins, mute, end', async () => {
  const create = jest.fn(async () => session());
  const { result } = await renderHook(() => useVoiceSession({ create }));
  await act(async () => { await result.current.start(); });
  expect(PermissionsAndroid.request).toHaveBeenCalledWith('android.permission.RECORD_AUDIO', expect.anything());
  const room = FakeRoom.last as FakeRoom;
  expect(room.connect).toHaveBeenCalledWith('wss://lk.test', 'jwt');
  expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  expect(result.current.phase).toBe('waiting-agent');

  await act(async () => { room.emit('pc', AGENT); });
  expect(result.current.phase).toBe('live');

  await act(async () => { await result.current.toggleMute(); });
  expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
  expect(result.current.muted).toBe(true);

  await act(async () => { await result.current.end(); });
  expect(api.endVoice).toHaveBeenCalledWith('sess-1');
  expect(room.disconnect).toHaveBeenCalled();
  expect(result.current.phase).toBe('ended');
  expect(result.current.summary).toBe('Done');
});

test('microphone permission denied never creates a session', async () => {
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
  const create = jest.fn(async () => session());
  const { result } = await renderHook(() => useVoiceSession({ create }));
  await act(async () => { await result.current.start(); });
  expect(create).not.toHaveBeenCalled();
  expect(result.current.phase).toBe('error');
  expect(result.current.failure?.kind).toBe('permission-denied');
});

test('double start dispatches only one session (single flight)', async () => {
  let release!: (value: VoiceSessionStart) => void;
  const create = jest.fn(() => new Promise<VoiceSessionStart>((resolve) => { release = resolve; }));
  const { result } = await renderHook(() => useVoiceSession({ create }));
  await act(async () => { void result.current.start(); void result.current.start(); await Promise.resolve(); });
  await act(async () => { release(session()); await flush(); });
  expect(create).toHaveBeenCalledTimes(1);
  expect(FakeRoom.instances).toBe(1);
});

test('agent that never joins is reported unavailable and the backend session is released', async () => {
  const { result } = await renderHook(() => useVoiceSession({ create: async () => session() }));
  await act(async () => { await result.current.start(); });
  await act(async () => { jest.advanceTimersByTime(AGENT_JOIN_TIMEOUT_MS + 100); await flush(); });
  expect(result.current.phase).toBe('error');
  expect(result.current.failure?.kind).toBe('agent-unavailable');
  expect(api.endVoice).toHaveBeenCalledWith('sess-1');
});

test('backend refusal (quota or agent unavailable) surfaces its message and opens no media connection', async () => {
  const { AppApiError } = jest.requireActual('@/api/client/error');
  const create = jest.fn(async () => { throw new AppApiError('Monthly voice limit reached', 429, 'AI_VOICE_QUOTA'); });
  const { result } = await renderHook(() => useVoiceSession({ create }));
  await act(async () => { await result.current.start(); });
  expect(result.current.failure?.message).toBe('Monthly voice limit reached');
  expect(FakeRoom.instances).toBe(0);
  expect(api.endVoice).not.toHaveBeenCalled();
});

test('connection failure ends the backend session and reports a retryable error', async () => {
  FakeRoom.failConnect = true;
  const { result } = await renderHook(() => useVoiceSession({ create: async () => session() }));
  await act(async () => { await result.current.start(); });
  FakeRoom.failConnect = false;
  expect(result.current.phase).toBe('error');
  expect(result.current.failure).toMatchObject({ kind: 'connection', retryable: true });
  expect(api.endVoice).toHaveBeenCalledWith('sess-1');
  expect((FakeRoom.last as FakeRoom).disconnect).toHaveBeenCalled();
});

test('dropping the connection while live fails with a retryable error and ends the session', async () => {
  const { result } = await renderHook(() => useVoiceSession({ create: async () => session() }));
  await act(async () => { await result.current.start(); });
  const room = FakeRoom.last as FakeRoom;
  await act(async () => { room.emit('pc', AGENT); });
  await act(async () => { room.emit('rc'); });
  expect(result.current.phase).toBe('reconnecting');
  await act(async () => { room.emit('rcd'); });
  expect(result.current.phase).toBe('waiting-agent');
  await act(async () => { room.emit('pc', AGENT); });
  expect(result.current.phase).toBe('live');
  await act(async () => { room.emit('dc'); await flush(); });
  expect(result.current.phase).toBe('error');
  expect(result.current.failure?.kind).toBe('connection');
  expect(api.endVoice).toHaveBeenCalledWith('sess-1');
});

test('session reaching its time limit stops the call', async () => {
  const { result } = await renderHook(() => useVoiceSession({ create: async () => session({ expiresAt: new Date(Date.now() + 3000).toISOString(), maxSessionSeconds: 3 }) }));
  await act(async () => { await result.current.start(); });
  const room = FakeRoom.last as FakeRoom;
  await act(async () => { room.emit('pc', AGENT); });
  await act(async () => { jest.advanceTimersByTime(4000); await flush(); });
  expect(result.current.phase).toBe('error');
  expect(api.endVoice).toHaveBeenCalledWith('sess-1');
});

test('unmounting disconnects the room and ends the open backend session', async () => {
  const view = await renderHook(() => useVoiceSession({ create: async () => session() }));
  await act(async () => { await view.result.current.start(); });
  const room = FakeRoom.last as FakeRoom;
  await act(async () => { room.emit('pc', AGENT); });
  await view.unmount();
  await flush();
  expect(room.disconnect).toHaveBeenCalled();
  expect(api.endVoice).toHaveBeenCalledWith('sess-1');
});

test('transcript from the backend is surfaced while live', async () => {
  api.voiceSession.mockResolvedValue({ sessionId: 'sess-1', status: 'ACTIVE', experienceType: 'CHAPTER_DOUBT_VOICE', initialGreeting: null, summary: null, runtimeState: { agentState: 'speaking', userState: null, lastProviderError: null }, messages: [{ id: 'm1', role: 'STUDENT', transcriptText: 'What is a fraction?', sequenceNumber: 1 }] });
  const { result } = await renderHook(() => useVoiceSession({ create: async () => session() }));
  await act(async () => { await result.current.start(); });
  await act(async () => { jest.advanceTimersByTime(3000); await flush(); });
  await waitFor(() => expect(result.current.transcript).toHaveLength(1));
  expect(result.current.agentState).toBe('speaking');
});
