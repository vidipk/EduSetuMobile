import type { AuthUser, MobileLoginRequest, MobileSession } from '@/api/contracts/auth';
import { authApi } from '@/api/auth/api';

import { accessTokenStore } from './access-token';
import { runSessionInvalidation } from './session-invalidation';
import { secureStorage, type SecureStorage } from './secure-storage';

export interface SessionSnapshot {
  user: AuthUser | null;
  status: 'bootstrapping' | 'authenticated' | 'unauthenticated';
}

type Listener = (snapshot: SessionSnapshot) => void;

export class SessionManager {
  private snapshot: SessionSnapshot = { user: null, status: 'bootstrapping' };
  private listeners = new Set<Listener>();
  private refreshPromise: Promise<string> | null = null;
  private logoutPromise: Promise<void> | null = null;
  private sessionEpoch = 0;

  constructor(private readonly storage: SecureStorage = secureStorage, private readonly api = authApi) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  async login(payload: MobileLoginRequest) {
    const epoch = ++this.sessionEpoch;
    return this.accept(await this.api.login(payload), epoch);
  }

  async bootstrap() {
    const epoch = this.sessionEpoch;
    const refreshToken = await this.storage.getRefreshToken();
    if (!refreshToken) {
      this.emit({ user: null, status: 'unauthenticated' });
      return;
    }
    try {
      await this.accept(await this.api.refresh({ refreshToken }), epoch);
    } catch {
      if (epoch === this.sessionEpoch) await this.clear();
    }
  }

  async refresh() {
    if (!this.refreshPromise) {
      const epoch = this.sessionEpoch;
      this.refreshPromise = this.rotate(epoch).finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }

  async logout(allDevices = false) {
    if (this.logoutPromise) return this.logoutPromise;
    this.logoutPromise = this.performLogout(allDevices).finally(() => { this.logoutPromise = null; });
    return this.logoutPromise;
  }

  private async performLogout(allDevices: boolean) {
    ++this.sessionEpoch;
    const accessToken = accessTokenStore.get();
    await this.clear(false);
    if (!accessToken) return;
    try {
      await (allDevices ? this.api.logoutAll(accessToken) : this.api.logout(accessToken));
    } catch {
      // The device session is already cleared, even when the backend is unreachable.
    }
  }

  async clear(incrementEpoch = true) {
    if (incrementEpoch) ++this.sessionEpoch;
    accessTokenStore.set(null);
    await this.storage.removeRefreshToken();
    runSessionInvalidation();
    this.emit({ user: null, status: 'unauthenticated' });
  }

  private async rotate(epoch: number) {
    const refreshToken = await this.storage.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token is available.');
    try {
      return await this.accept(await this.api.refresh({ refreshToken }), epoch);
    } catch (error) {
      if (epoch === this.sessionEpoch) await this.clear();
      throw error;
    }
  }

  private async accept(session: MobileSession, epoch: number) {
    if (epoch !== this.sessionEpoch) throw new Error('Session operation is no longer current.');
    await this.storage.setRefreshToken(session.refreshToken);
    if (epoch !== this.sessionEpoch) return accessTokenStore.get() ?? '';
    accessTokenStore.set(session.accessToken);
    this.emit({ user: session.user, status: 'authenticated' });
    return session.accessToken;
  }

  private emit(snapshot: SessionSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const sessionManager = new SessionManager();
