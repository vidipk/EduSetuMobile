import { useInstitutionExperience } from '@/features/learning/experience-store';
import { VeralayamPerformance } from '@/features/learning/veralayam-ui/VeralayamProgress';
import MyPerformanceScreen from '@/features/performance/MyPerformanceScreen';

export default function StudentPerformanceRoute() {
  const institution = useInstitutionExperience();
  return institution ? <VeralayamPerformance /> : <MyPerformanceScreen />;
}
