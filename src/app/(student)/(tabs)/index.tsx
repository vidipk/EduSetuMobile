import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppScreen, AppText } from '@/design-system/components';
import { useInstitutionExperience } from '@/features/learning/experience-store';
import { LearningHomeScreen } from '@/features/learning/LearningHomeScreen';

export default function StudentHomeRoute() {
  const institution = useInstitutionExperience();
  return institution ? <LearningHomeScreen /> : <StandardStudentHome />;
}

function StandardStudentHome() {
  const { user } = useAuth();
  return (
    <AppScreen style={styles.screen}>
      <AppText style={styles.title}>Home</AppText>
      <AppText>Welcome, {user?.fullName}.</AppText>
      <AppCard style={styles.card}>
        <AppText style={styles.cardTitle}>My performance</AppText>
        <AppText style={styles.muted}>Released quiz scores, graded homework, attendance and areas to review.</AppText>
        <AppButton title="View my performance" onPress={() => router.push('/performance')} />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 16 },
  title: { fontSize: 26, fontWeight: '800' },
  card: { gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  muted: { opacity: 0.7 },
});
