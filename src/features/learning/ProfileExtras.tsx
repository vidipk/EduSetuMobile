import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { AppButton, AppCard, AppText } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';
import { useAuth } from '@/auth/AuthProvider';

/** Institution identity, account security and privacy, shown on the profile only for the institution experience. */
export function ProfileExtras() {
  const { user } = useAuth();
  return (
    <View style={styles.wrap}>
      <AppCard style={styles.card}>
        <AppText style={styles.title}>Your institution</AppText>
        <AppText style={styles.value}>{user?.organization?.name ?? 'Your school'}</AppText>
        <AppText style={styles.muted}>Your account is managed by your institution administrator.</AppText>
      </AppCard>
      <AppCard style={styles.card}>
        <AppText style={styles.title}>Account and privacy</AppText>
        <AppText style={styles.muted}>
          Your quiz answers and results are visible only to you and the teachers authorised for your class. Opening a lecture link is
          recorded as an open, never as proof of watching. Contact your administrator to correct or remove account information.
        </AppText>
        <AppButton title="Change password" onPress={() => router.push('/(student)/change-password' as Href)} />
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  card: { gap: spacing.sm },
  title: { fontSize: 17, fontWeight: '800' },
  value: { fontSize: 16 },
  muted: { color: colors.muted, lineHeight: 21 },
});
