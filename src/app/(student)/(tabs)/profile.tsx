import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppCard, AppScreen, AppText } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { useInstitutionExperience } from '@/features/learning/experience-store';
import { ProfileExtras } from '@/features/learning/ProfileExtras';

export default function StudentProfileScreen() {
  const { user, logout } = useAuth();
  const institution = useInstitutionExperience();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setError(null);
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch {
      setError('You were signed out on this device. Open the app again to continue.');
      router.replace('/(auth)/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <AppText style={styles.eyebrow}>Student profile</AppText>
        <AppText style={styles.title}>Profile</AppText>
      </View>
      <AppCard style={styles.card}>
        <AppText style={styles.name}>{user?.fullName ?? 'Student'}</AppText>
        <Meta label="Email" value={user?.email ?? 'Not available'} />
        <Meta label="Role" value={user?.role ?? 'Student'} />
        <Meta label="Organization" value={user?.organization?.name ?? 'EduSetu'} />
      </AppCard>
      {institution ? <ProfileExtras /> : null}
      {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <AppButton title="Log out" loading={loggingOut} disabled={loggingOut} onPress={() => void handleLogout()} />
    </AppScreen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <AppText style={styles.metaLabel}>{label}</AppText>
      <AppText style={styles.metaValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  header: { gap: spacing.xs },
  eyebrow: { color: colors.student, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  card: { gap: spacing.md },
  name: { fontSize: 22, fontWeight: '800' },
  meta: { gap: spacing.xs },
  metaLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  metaValue: { color: colors.text, fontSize: 16, lineHeight: 22 },
  error: { color: colors.danger },
});
