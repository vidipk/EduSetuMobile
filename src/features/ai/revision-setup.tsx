import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { studentAiApi } from '@/api/academics/ai-learning';
import type { RevisionStudyPhase } from '@/api/contracts/ai-learning';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';
import { Chips, ErrorPanel, Notice } from '@/features/performance/components';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { SkeletonList } from '@/features/teacher-ops/ui';

/**
 * Subject, study phase and chapter selection for revision. Phases and chapters come from the
 * backend's revision configuration; the app never invents phases or chapter lists.
 */
export function useRevisionSetup() {
  const { user } = useAuth();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [phase, setPhase] = useState<RevisionStudyPhase | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const config = useRemoteData(user ? `ai-rev-config:${user.id}` : null, () => studentAiApi.revisionConfig());
  const chapters = useRemoteData(user && subjectId && phase ? `ai-rev-chapters:${user.id}:${subjectId}:${phase}` : null, () => studentAiApi.revisionChapters(subjectId as string, phase as RevisionStudyPhase));
  const available = chapters.data?.chapters ?? [];
  const selectedIds = picked ?? available.filter((chapter) => chapter.selectedByDefault).map((chapter) => chapter.id);
  const valid = selectedIds.filter((id) => available.some((chapter) => chapter.id === id));

  return {
    config,
    chapters,
    subjectId,
    phase,
    available,
    selectedIds: valid,
    canStart: Boolean(subjectId && phase && valid.length > 0),
    selectSubject: (id: string) => { setSubjectId(id); setPicked(null); },
    selectPhase: (value: RevisionStudyPhase) => { setPhase(value); setPicked(null); },
    toggleChapter: (id: string) => setPicked(valid.includes(id) ? valid.filter((entry) => entry !== id) : [...valid, id]),
    selectAll: () => setPicked(available.map((chapter) => chapter.id)),
  };
}

export type RevisionSetup = ReturnType<typeof useRevisionSetup>;

export function RevisionSetupPanel({ setup, disabled }: { setup: RevisionSetup; disabled?: boolean }) {
  const { config } = setup;
  return (
    <View style={{ gap: spacing.md }}>
      {config.loading ? <SkeletonList rows={1} /> : null}
      {config.error ? <ErrorPanel error={config.error} onRetry={config.reload} /> : null}
      {config.data && config.data.subjects.length === 0 ? <AppText>No subjects are assigned to your class yet.</AppText> : null}
      {config.data ? (
        <>
          <Chips label="Subject" options={config.data.subjects.map((subject) => ({ id: subject.id, label: subject.name }))} value={setup.subjectId ?? ''} onChange={(id) => { if (!disabled) setup.selectSubject(id); }} />
          {config.data.availableStudyPhases.length === 0 ? <AppText>No revision phases are configured for your class.</AppText> : (
            <Chips label="Study phase" options={config.data.availableStudyPhases.map((entry) => ({ id: entry.value, label: entry.label }))} value={setup.phase ?? ''} onChange={(value) => { if (!disabled) setup.selectPhase(value as RevisionStudyPhase); }} />
          )}
        </>
      ) : null}
      {setup.chapters.loading ? <SkeletonList rows={1} /> : null}
      {setup.chapters.error ? <ErrorPanel error={setup.chapters.error} onRetry={setup.chapters.reload} /> : null}
      {setup.chapters.data && setup.available.length === 0 ? <Notice tone="warning">{setup.chapters.data.emptyReason ?? 'No chapters are configured for this phase.'}</Notice> : null}
      {setup.available.length ? (
        <View accessibilityLabel="Chapters to revise" style={{ gap: spacing.sm }}>
          <AppText style={{ fontWeight: '700' }}>Chapters ({setup.selectedIds.length} of {setup.available.length} selected)</AppText>
          <View style={styles.wrap}>
            {setup.available.map((chapter) => {
              const on = setup.selectedIds.includes(chapter.id);
              return (
                <Pressable key={chapter.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Chapter ${chapter.name}`} disabled={disabled} onPress={() => setup.toggleChapter(chapter.id)} style={[styles.chip, on && styles.chipOn]}>
                  <AppText style={[styles.chipText, on && styles.chipTextOn]}>{on ? '✓ ' : ''}{chapter.name}</AppText>
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" disabled={disabled} onPress={setup.selectAll}><AppText style={{ color: colors.primary, fontWeight: '700' }}>Select all</AppText></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextOn: { color: '#fff', fontWeight: '700' },
});
