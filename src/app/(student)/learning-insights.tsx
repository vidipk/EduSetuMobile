import { Redirect } from 'expo-router';

import { useInstitutionExperience } from '@/features/learning/experience-store';
import { VeralayamInsights } from '@/features/learning/veralayam-ui/VeralayamProgress';

/** Institution-experience screen; standard schools are sent to the original performance screen. */
export default function LearningInsightsRoute() {
  const institution = useInstitutionExperience();
  return institution ? <VeralayamInsights /> : <Redirect href="/(student)/performance" />;
}
