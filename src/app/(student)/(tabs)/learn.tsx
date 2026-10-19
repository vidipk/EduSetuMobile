import AiHubScreen from '@/features/ai/AiHubScreen';
import { useInstitutionExperience } from '@/features/learning/experience-store';
import { LearnScreen } from '@/features/learning/LearnScreen';

export default function StudentLearnRoute() {
  const institution = useInstitutionExperience();
  return institution ? <LearnScreen /> : <AiHubScreen />;
}
