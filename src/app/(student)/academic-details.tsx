import { Redirect } from 'expo-router';

import { useInstitutionExperience } from '@/features/learning/experience-store';
import { VeralayamAcademicDetails } from '@/features/learning/veralayam-ui/VeralayamProgress';

/** Institution-experience screen; standard schools are sent to the original performance screen. */
export default function AcademicDetailsRoute() {
  const institution = useInstitutionExperience();
  return institution ? <VeralayamAcademicDetails /> : <Redirect href="/(student)/performance" />;
}
