import { FoundationScreen } from '@/components/common/FoundationScreen';
import { useInstitutionExperience } from '@/features/learning/experience-store';
import { StudentNoticesScreen } from '@/features/learning/StudentNoticesScreen';

export default function StudentNoticesRoute() {
  const institution = useInstitutionExperience();
  return institution ? <StudentNoticesScreen /> : <FoundationScreen title="Notices" />;
}
