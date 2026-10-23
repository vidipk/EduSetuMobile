import { create } from 'zustand';

import { learningApi } from '@/api/academics/learning';
import { AppApiError } from '@/api/client/error';
import type { LearningExperienceConfig } from '@/api/contracts/learning';
import { env } from '@/config/env';

/** Why the current layout was chosen. Only `enabled` shows the institution UI; every other value is the standard UI. */
export type ExperienceOutcome =
  | 'enabled'
  | 'disabled'
  | 'request-failed'
  | 'route-missing'
  | 'session-unavailable'
  | 'unexpected-response';

/** Development-only and non-sensitive: never logs tokens, user data or the full API URL, only host and path. */
function logOutcome(outcome: ExperienceOutcome, detail: Record<string, unknown> = {}) {
  if (!__DEV__) return;
  let apiHost = 'invalid-url';
  try { apiHost = new URL(env.EXPO_PUBLIC_API_BASE_URL).host; } catch { /* keep placeholder */ }
  console.log('[learning-experience]', outcome, { appEnv: env.APP_ENV, apiHost, ...detail });
}

function classifyFailure(error: unknown): { outcome: ExperienceOutcome; detail: Record<string, unknown> } {
  const status = error instanceof AppApiError ? error.status : undefined;
  const requestId = error instanceof AppApiError ? error.requestId : undefined;
  if (status === 401) return { outcome: 'session-unavailable', detail: { status } };
  // A deployed backend answers an unknown tenant with { enabled: false }; a 404 means the route itself is absent,
  // i.e. this API environment does not have the learning module deployed.
  if (status === 404) return { outcome: 'route-missing', detail: { status, requestId } };
  return { outcome: 'request-failed', detail: { status: status ?? 'network', requestId } };
}

interface ExperienceState {
  /** idle: not asked yet; ready/failed: a definitive answer exists. Only `ready` + `enabled` shows the institution UI. */
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** Diagnostic reason for the current decision; null until the first lookup finishes. */
  outcome: ExperienceOutcome | null;
  enabled: boolean;
  config: LearningExperienceConfig | null;
  load: () => Promise<void>;
  reset: () => void;
}

/**
 * Whether the signed-in learner's organization uses the institution-specific experience.
 * Any failure falls back to the standard EduSetu screens, so a network problem can never
 * lock a learner out or switch a standard school into the custom experience.
 */
export const useLearningExperience = create<ExperienceState>((set, get) => ({
  status: 'idle',
  outcome: null,
  enabled: false,
  config: null,
  load: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      const experience = await learningApi.experience();
      if (!experience || typeof experience.enabled !== 'boolean' || (experience.enabled && !experience.config)) {
        logOutcome('unexpected-response');
        set({ status: 'failed', outcome: 'unexpected-response', enabled: false, config: null });
        return;
      }
      if (experience.enabled) {
        logOutcome('enabled', { experienceKey: experience.experienceKey });
        set({ status: 'ready', outcome: 'enabled', enabled: true, config: experience.config });
      } else {
        logOutcome('disabled');
        set({ status: 'ready', outcome: 'disabled', enabled: false, config: null });
      }
    } catch (error) {
      const { outcome, detail } = classifyFailure(error);
      logOutcome(outcome, detail);
      set({ status: 'failed', outcome, enabled: false, config: null });
    }
  },
  reset: () => set({ status: 'idle', outcome: null, enabled: false, config: null }),
}));

/** True only once the server has confirmed the institution experience for this organization. */
export const useInstitutionExperience = () => useLearningExperience((state) => state.enabled);
