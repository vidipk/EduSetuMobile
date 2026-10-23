import { Redirect } from 'expo-router';

import { useInstitutionExperience } from '@/features/learning/experience-store';
import { VeralayamImprovementPlan } from '@/features/learning/veralayam-ui/VeralayamProgress';

/** Institution-experience screen; standard schools are sent to the original performance screen. */
export default function ImprovementPlanRoute() {
  const institution = useInstitutionExperience();
  return institution ? <VeralayamImprovementPlan /> : <Redirect href="/(student)/performance" />;
}
