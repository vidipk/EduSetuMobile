import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { AudioSession, registerGlobals } from '@livekit/react-native';
import { ParticipantKind, Room, RoomEvent } from 'livekit-client';

import { studentAiApi } from '@/api/academics/ai-learning';
import type { VoiceSessionStart, VoiceTranscriptMessage } from '@/api/contracts/ai-learning';
import type { ErrorPresentation } from '@/features/performance/format';

import { describeAiError } from '../errors';

export type VoicePhase = 'idle' | 'permission' | 'creating' | 'connecting' | 'waiting-agent' | 'live' | 'reconnecting' | 'ending' | 'ended' | 'error';

export type VoiceFailure = ErrorPresentation & { kind: 'permission-denied' | 'agent-unavailable' | 'connection' | 'api'; retryable: boolean };

const failureOf = (kind: VoiceFailure['kind'], message: string, retryable: boolean): VoiceFailure => ({ kind, message, retryable, sessionExpired: false, forbidden: false, notFound: false });

/** How long to wait for the AI agent to join the room before treating it as unavailable. */
export const AGENT_JOIN_TIMEOUT_MS = 30_000;
const POLL_MS = 2_500;

let globalsRegistered = false;
function ensureGlobals() {
  if (!globalsRegistered) {
    registerGlobals();
    globalsRegistered = true;
  }
}

async function requestMicrophone(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone access',
    message: 'EduSetu needs the microphone so you can talk to your AI tutor.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export interface UseVoiceSessionOptions {
  /** Creates (or resumes) the backend session. Called once per start; the backend dispatches the agent. */
  create: () => Promise<VoiceSessionStart>;
}

/**
 * Real-time voice session lifecycle: permission -> backend session (quota, room, token, agent dispatch)
 * -> LiveKit connection -> agent joins -> live conversation -> end. The participant token lives only in
 * this closure. Unmounting always disconnects, stops the audio session and, if a session is still open,
 * ends it on the backend so the single active session slot is released.
 */
export function useVoiceSession({ create }: UseVoiceSessionOptions) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [failure, setFailure] = useState<VoiceFailure | null>(null);
  const [muted, setMuted] = useState(false);
  const [agentState, setAgentState] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<VoiceTranscriptMessage[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const expiresAtRef = useRef<number | null>(null);
  const lockRef = useRef(false);
  const mountedRef = useRef(true);
  const phaseRef = useRef<VoicePhase>('idle');
  const agentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const createRef = useRef(create);
  useEffect(() => { createRef.current = create; }, [create]);

  const setPhaseBoth = useCallback((next: VoicePhase) => {
    phaseRef.current = next;
    if (mountedRef.current) setPhase(next);
  }, []);

  const clearTimers = () => {
    if (agentTimer.current) clearTimeout(agentTimer.current);
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (clockTimer.current) clearInterval(clockTimer.current);
    agentTimer.current = null;
    pollTimer.current = null;
    clockTimer.current = null;
  };

  const teardownMedia = useCallback(async () => {
    clearTimers();
    const room = roomRef.current;
    roomRef.current = null;
    try { room?.removeAllListeners(); await room?.disconnect(); } catch { /* already disconnected */ }
    try { await AudioSession.stopAudioSession(); } catch { /* audio session not started */ }
  }, []);

  const fail = useCallback(async (next: VoiceFailure, endBackend: boolean) => {
    const sessionId = sessionIdRef.current;
    await teardownMedia();
    if (endBackend && sessionId) {
      sessionIdRef.current = null;
      try { await studentAiApi.endVoice(sessionId); } catch { /* the backend also expires stale sessions */ }
    }
    if (mountedRef.current) setFailure(next);
    setPhaseBoth('error');
  }, [setPhaseBoth, teardownMedia]);

  const poll = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || phaseRef.current === 'ending' || phaseRef.current === 'ended') return;
    try {
      const detail = await studentAiApi.voiceSession(sessionId);
      if (!mountedRef.current) return;
      setTranscript(detail.messages.filter((message) => message.transcriptText));
      setAgentState(detail.runtimeState.agentState);
      if (['ENDED', 'EXPIRED', 'FAILED', 'CANCELLED'].includes(detail.status)) {
        setSummary(detail.summary);
        await teardownMedia();
        sessionIdRef.current = null;
        setPhaseBoth('ended');
      }
    } catch {
      // Transient polling failures are ignored; the media connection state drives the UI.
    }
  }, [setPhaseBoth, teardownMedia]);

  const start = useCallback(async () => {
    if (lockRef.current) return; // single flight: never dispatch a second agent
    lockRef.current = true;
    setFailure(null);
    setTranscript([]);
    setMuted(false);
    setSummary(null);
    try {
      setPhaseBoth('permission');
      if (!(await requestMicrophone())) {
        await fail(failureOf('permission-denied', 'Allow microphone access in Settings to talk to the AI tutor.', false), false);
        return;
      }

      setPhaseBoth('creating');
      let session: VoiceSessionStart;
      try {
        session = await createRef.current();
      } catch (caught) {
        await fail({ ...describeAiError(caught), kind: 'api', retryable: true }, false);
        return;
      }
      sessionIdRef.current = session.sessionId;
      setGreeting(session.initialGreeting ?? null);
      expiresAtRef.current = Math.min(Date.parse(session.expiresAt) || Number.MAX_SAFE_INTEGER, Date.now() + session.maxSessionSeconds * 1000);

      setPhaseBoth('connecting');
      ensureGlobals();
      await AudioSession.startAudioSession();
      const room = new Room({ adaptiveStream: false, dynacast: false });
      roomRef.current = room;

      const markLive = () => {
        if (agentTimer.current) clearTimeout(agentTimer.current);
        agentTimer.current = null;
        if (phaseRef.current === 'waiting-agent' || phaseRef.current === 'reconnecting') setPhaseBoth('live');
      };
      room
        .on(RoomEvent.ParticipantConnected, (participant) => { if (participant.kind === ParticipantKind.AGENT) markLive(); })
        .on(RoomEvent.Reconnecting, () => setPhaseBoth('reconnecting'))
        .on(RoomEvent.Reconnected, () => setPhaseBoth(Array.from(room.remoteParticipants.values()).some((p) => p.kind === ParticipantKind.AGENT) ? 'live' : 'waiting-agent'))
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (participant.kind === ParticipantKind.AGENT && phaseRef.current === 'live') void fail(failureOf('agent-unavailable', 'The AI tutor left the session. Start again to continue.', true), true);
        })
        .on(RoomEvent.Disconnected, () => {
          if (phaseRef.current === 'live' || phaseRef.current === 'reconnecting' || phaseRef.current === 'waiting-agent') {
            void fail(failureOf('connection', 'The voice connection dropped. Check your internet and start again.', true), true);
          }
        });

      try {
        await room.connect(session.livekitUrl, session.participantToken);
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        await fail(failureOf('connection', 'The voice connection could not be established. Check your internet and try again.', true), true);
        return;
      }

      setPhaseBoth('waiting-agent');
      if (Array.from(room.remoteParticipants.values()).some((p) => p.kind === ParticipantKind.AGENT)) markLive();
      agentTimer.current = setTimeout(() => {
        if (phaseRef.current === 'waiting-agent') {
          void fail(failureOf('agent-unavailable', 'The AI voice tutor did not join. Please try again in a moment.', true), true);
        }
      }, AGENT_JOIN_TIMEOUT_MS);
      pollTimer.current = setInterval(() => void poll(), POLL_MS);
      clockTimer.current = setInterval(() => {
        const left = Math.max(0, Math.round(((expiresAtRef.current ?? 0) - Date.now()) / 1000));
        if (mountedRef.current) setSecondsLeft(left);
        if (left <= 0 && (phaseRef.current === 'live' || phaseRef.current === 'reconnecting')) {
          void fail(failureOf('connection', 'This voice session reached its time limit. Start a new one to continue.', true), true);
        }
      }, 1000);
    } finally {
      lockRef.current = false;
    }
  }, [fail, poll, setPhaseBoth]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
    } catch { /* keep the previous state when the change fails */ }
  }, [muted]);

  const end = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || phaseRef.current === 'ending') return;
    setPhaseBoth('ending');
    await teardownMedia();
    try {
      const result = await studentAiApi.endVoice(sessionId);
      sessionIdRef.current = null;
      if (mountedRef.current) setSummary(result.summary ?? null);
      setPhaseBoth('ended');
    } catch (caught) {
      await fail({ ...describeAiError(caught), kind: 'api', retryable: true }, false);
    }
  }, [fail, setPhaseBoth, teardownMedia]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      void teardownMedia();
      if (sessionId) void studentAiApi.endVoice(sessionId).catch(() => undefined);
    };
  }, [teardownMedia]);

  return { phase, failure, muted, agentState, transcript, secondsLeft, greeting, summary, start, end, toggleMute };
}
