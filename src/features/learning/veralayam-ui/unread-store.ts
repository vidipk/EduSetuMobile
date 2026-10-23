import { create } from 'zustand';

import { learningApi } from '@/api/academics/learning';

interface UnreadState {
  count: number;
  /** Server-reported unread count (GET /notifications/unread-count). Failures leave the count unchanged. */
  load: () => Promise<void>;
  setCount: (count: number) => void;
  reset: () => void;
}

export const useUnreadNotices = create<UnreadState>((set) => ({
  count: 0,
  load: async () => {
    try {
      set({ count: await learningApi.unreadCount() });
    } catch {
      /* the bell simply shows no dot */
    }
  },
  setCount: (count) => set({ count: Math.max(0, count) }),
  reset: () => set({ count: 0 }),
}));
