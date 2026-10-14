import { useMemo, useState } from 'react';

import type { StudentPerformance } from '@/api/contracts/performance';

export const ALL_SUBJECTS = 'all';

/**
 * Subject filter choices learned from unfiltered responses for one owner
 * (a child, a student). They reset when the owner changes, so one child's
 * subjects never appear under another child.
 */
export function useSubjectOptions(ownerKey: string | null, data: StudentPerformance | null) {
  const [learned, setLearned] = useState<{ ownerKey: string; subjects: { id: string; label: string }[] } | null>(null);

  // Derive during render: only an unfiltered response defines the option list.
  if (ownerKey && data && data.scope.subjectId === null && data.subjects.length) {
    const subjects = data.subjects.map((subject) => ({ id: subject.subjectId, label: subject.subjectName }));
    const same = learned?.ownerKey === ownerKey && learned.subjects.length === subjects.length && learned.subjects.every((entry, index) => entry.id === subjects[index].id);
    if (!same) setLearned({ ownerKey, subjects });
  }

  return useMemo(() => {
    const subjects = learned && learned.ownerKey === ownerKey ? learned.subjects : [];
    return subjects.length > 1 ? [{ id: ALL_SUBJECTS, label: 'All subjects' }, ...subjects] : [];
  }, [learned, ownerKey]);
}
