import { useState } from 'react';
import { router } from 'expo-router';

import { performanceApi } from '@/api/academics/performance';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppScreen } from '@/design-system/components';

import { Chips, ErrorPanel, LoadingPanel, PerformanceScroll, PeriodChips, StudentPerformanceView } from './components';
import { presetRange, type PeriodPreset } from './period';
import { useRemoteData } from './use-remote-data';
import { ALL_SUBJECTS, useSubjectOptions } from './use-subject-options';

export default function MyPerformanceScreen() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<PeriodPreset>('academic-year');
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const key = user ? `me:${user.id}:${preset}:${subject}` : null;
  const { data, error, loading, refreshing, reload, refresh } = useRemoteData(key, () =>
    performanceApi.getMyPerformance({ ...presetRange(preset), subjectId: subject === ALL_SUBJECTS ? undefined : subject }),
  );
  const subjectOptions = useSubjectOptions(user ? `me:${user.id}` : null, data);

  return (
    <AppScreen style={{ padding: 0 }}>
      <PerformanceScroll refreshing={refreshing} onRefresh={() => void refresh()}>
        <AppButton title="Back" onPress={() => router.back()} />
        <PeriodChips value={preset} onChange={setPreset} />
        {subjectOptions.length ? <Chips label="Subject" options={subjectOptions} value={subject} onChange={setSubject} /> : null}
        {error ? <ErrorPanel error={error} onRetry={reload} /> : null}
        {loading ? <LoadingPanel /> : null}
        {data ? <StudentPerformanceView data={data} /> : null}
      </PerformanceScroll>
    </AppScreen>
  );
}
