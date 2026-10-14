import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import type { MobileLoginRequest } from '@/api/contracts/auth';
import { sessionManager, type SessionSnapshot } from './session-manager';

interface AuthContextValue extends SessionSnapshot {
  login: (payload: MobileLoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState(sessionManager.getSnapshot());

  useEffect(() => {
    const unsubscribe = sessionManager.subscribe(setSnapshot);
    void sessionManager.bootstrap();
    return () => { unsubscribe(); };
  }, []);

  return <AuthContext.Provider value={{
    ...snapshot,
    login: async (payload) => { await sessionManager.login(payload); },
    logout: () => sessionManager.logout(),
    logoutAll: () => sessionManager.logout(true),
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
