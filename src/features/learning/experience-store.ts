import { create } from 'zustand';

import { learningApi } from '@/api/academics/learning';
import type { LearningExperienceConfig } from '@/api/contracts/learning';

interface ExperienceState {
  /** idle: not asked yet; ready/failed: a definitive answer exists. Only `ready` + `enabled` shows the institution UI. */
  status: 'idle' | 'loading' | 'ready' | 'failed';
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
  enabled: false,
  config: null,
  load: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      const experience = await learningApi.experience();
      set(experience.enabled
        ? { status: 'ready', enabled: true, config: experience.config }
        : { status: 'ready', enabled: false, config: null });
    } catch {
      set({ status: 'failed', enabled: false, config: null });
    }
  },
  reset: () => set({ status: 'idle', enabled: false, config: null }),
}));

/** True only once the server has confirmed the institution experience for this organization. */
export const useInstitutionExperience = () => useLearningExperience((state) => state.enabled);
