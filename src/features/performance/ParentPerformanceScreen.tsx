import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { performanceApi } from '@/api/academics/performance';
import { useAuth } from '@/auth/AuthProvider';
import { AppScreen, AppText, EmptyState } from '@/design-system/components';

import { Chips, ErrorPanel, LoadingPanel, PerformanceScroll, PeriodChips, StudentPerformanceView } from './components';
import { presetRange, type PeriodPreset } from './period';
import { useParentContext } from '@/stores/parent-context';
import { useRemoteData } from './use-remote-data';
import { ALL_SUBJECTS, useSubjectOptions } from './use-subject-options';

export default function ParentPerformanceScreen() {
  const { user } = useAuth();
  // Shared with the other parent screens so the selected child is the same everywhere.
  const selectedId = useParentContext((state) => state.selectedStudentProfileId);
  const setSelectedId = useParentContext((state) => state.selectStudent);
  const [preset, setPreset] = useState<PeriodPreset>('academic-year');
  const [subject, setSubject] = useState(ALL_SUBJECTS);

  const children = useRemoteData(user ? `children:${user.id}` : null, () => performanceApi.listChildren());
  const list = children.data ?? [];
  // Only a child returned by the authorized list can ever be requested.
  const child = list.find((entry) => entry.studentProfileId === selectedId) ?? list[0] ?? null;

  const key = user && child ? `child:${user.id}:${child.studentProfileId}:${preset}:${subject}` : null;
  const perf = useRemoteData(key, () =>
    performanceApi.getChildPerformance((child as NonNullable<typeof child>).studentProfileId, { ...presetRange(preset), subjectId: subject === ALL_SUBJECTS ? undefined : subject }),
  );
  const subjectOptions = useSubjectOptions(user && child ? `child:${user.id}:${child.studentProfileId}` : null, perf.data);

  // If the backend no longer authorizes this child, refresh the authorized list once.
  const handledError = useRef<unknown>(null);
  const { reload: reloadChildren } = children;
  useEffect(() => {
    if ((perf.error?.notFound || perf.error?.forbidden) && handledError.current !== perf.error) {
      handledError.current = perf.error;
      setSelectedId(null);
      reloadChildren();
    }
  }, [perf.error, reloadChildren, setSelectedId]);

  const selectChild = (id: string) => {
    if (id === child?.studentProfileId) return;
    setSelectedId(id);
    setSubject(ALL_SUBJECTS);
  };

  // Never render a response that belongs to a different child than the one shown.
  const data = perf.data && child && perf.data.student.studentProfileId === child.studentProfileId ? perf.data : null;

  return (
    <AppScreen style={{ padding: 0 }}>
      <PerformanceScroll refreshing={perf.refreshing || children.refreshing} onRefresh={() => { void children.refresh(); void perf.refresh(); }}>
        {children.loading ? <LoadingPanel label="Loading your children..." /> : null}
        {children.error ? <ErrorPanel error={children.error} onRetry={children.reload} /> : null}
        {children.data && list.length === 0 ? <EmptyState title="No linked children" detail="Ask your school to link your child to your account." /> : null}
        {list.length > 1 ? <Chips label="Child" options={list.map((entry) => ({ id: entry.studentProfileId, label: entry.name }))} value={child?.studentProfileId ?? ''} onChange={selectChild} /> : null}
        {child ? (
          <View accessibilityLabel={`Performance for ${child.name}`}>
            <AppText style={{ fontWeight: '800', fontSize: 18 }}>{child.name}</AppText>
            <AppText style={{ opacity: 0.7 }}>{child.class.name} {child.section.name} · {child.academicYear.name}</AppText>
          </View>
        ) : null}
        {child ? <PeriodChips value={preset} onChange={setPreset} /> : null}
        {child && subjectOptions.length ? <Chips label="Subject" options={subjectOptions} value={subject} onChange={setSubject} /> : null}
        {perf.error ? <ErrorPanel error={perf.error.notFound || perf.error.forbidden ? { ...perf.error, message: 'This child is no longer available on your account.' } : perf.error} onRetry={perf.reload} /> : null}
        {child && perf.loading ? <LoadingPanel /> : null}
        {data ? <StudentPerformanceView data={data} /> : null}
      </PerformanceScroll>
    </AppScreen>
  );
}
