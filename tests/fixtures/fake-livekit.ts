type Handler = (...args: unknown[]) => void;

/** Minimal stand-in for livekit-client's Room, driven by tests through `emit`. */
export class FakeRoom {
  static last: FakeRoom | null = null;
  static instances = 0;
  static failConnect = false;
  handlers = new Map<string, Handler[]>();
  remoteParticipants = new Map<string, { kind: number }>();
  connect = jest.fn(async () => { if (FakeRoom.failConnect) throw new Error('connect failed'); });
  disconnect = jest.fn(async () => undefined);
  removeAllListeners = jest.fn();
  localParticipant = { setMicrophoneEnabled: jest.fn(async () => undefined) };
  constructor() { FakeRoom.last = this; FakeRoom.instances += 1; }
  on(event: string, handler: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]); return this; }
  emit(event: string, ...args: unknown[]) { (this.handlers.get(event) ?? []).forEach((handler) => handler(...args)); }
}
