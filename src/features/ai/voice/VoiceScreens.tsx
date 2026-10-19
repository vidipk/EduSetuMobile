import { studentAiApi } from '@/api/academics/ai-learning';
import { useRevisionSetup, RevisionSetupPanel } from '../revision-setup';
import { ScopePicker, useStudentScope } from '../scope';

import { VoiceSessionView } from './VoiceSessionView';

export function DoubtVoiceScreen() {
  const scope = useStudentScope();
  const features = scope.dashboard.data?.featureAvailability;
  const reason = features ? (features.voiceAvailable && features.voiceDoubtAssistantEnabled ? null : (features.voiceDisabledReason ?? 'Voice doubt solving is not available for you right now.')) : null;
  return (
    <VoiceSessionView
      title="Ask AI by voice"
      subtitle="Talk through a doubt in a chapter. Your AI tutor answers from your school material."
      setup={<ScopePicker scope={scope} />}
      canStart={Boolean(scope.subject && scope.chapter && features)}
      unavailableReason={reason}
      create={() => studentAiApi.startDoubtVoice({ subjectId: (scope.subject as { id: string }).id, chapterId: (scope.chapter as { id: string }).id })}
    />
  );
}

export function RevisionVoiceScreen() {
  const setup = useRevisionSetup();
  const capability = setup.config.data?.capabilities.voice;
  const reason = capability && !capability.available ? (capability.disabledReason ?? 'Voice revision is not available for you right now.') : null;
  return (
    <VoiceSessionView
      title="Revise by voice"
      subtitle="A guided spoken revision of the chapters you choose: recap, key points and quick questions."
      setup={<RevisionSetupPanel setup={setup} />}
      canStart={setup.canStart && Boolean(capability)}
      unavailableReason={reason}
      create={() => studentAiApi.startRevisionVoice({ subjectId: setup.subjectId as string, studyPhase: setup.phase as NonNullable<typeof setup.phase>, chapterIds: setup.selectedIds })}
    />
  );
}
