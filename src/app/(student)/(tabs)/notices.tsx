import { FoundationScreen } from '@/components/common/FoundationScreen';
import { useInstitutionExperience } from '@/features/learning/experience-store';
import { VeralayamNotifications } from '@/features/learning/veralayam-ui/VeralayamNotifications';

export default function StudentNoticesRoute() {
  const institution = useInstitutionExperience();
  return institution ? <VeralayamNotifications /> : <FoundationScreen title="Notices" />;
}
