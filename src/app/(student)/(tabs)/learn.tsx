import AiHubScreen from '@/features/ai/AiHubScreen';
import { useInstitutionExperience } from '@/features/learning/experience-store';
import { VeralayamLearnScreen } from '@/features/learning/subjects/VeralayamLearnScreen';

export default function StudentLearnRoute() {
  const institution = useInstitutionExperience();
  return institution ? <VeralayamLearnScreen /> : <AiHubScreen />;
}
