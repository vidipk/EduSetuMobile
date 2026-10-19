import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { learningApi } from '@/api/academics/learning';
import { normalizeApiError } from '@/api/client/error';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppScreen, AppText, PasswordInput } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';

/** Mirrors the backend rule (min 8) and adds light guidance; the server remains authoritative. */
export function validateNewPassword(current: string, next: string, confirm: string): string | null {
  if (next.length < 8) return 'Use at least 8 characters.';
  if (next === current) return 'Choose a password different from your current one.';
  if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return 'Include at least one letter and one number.';
  if (next !== confirm) return 'The new passwords do not match.';
  return null;
}

export function ChangePasswordScreen() {
  const { user, logout } = useAuth();
  const forced = Boolean(user?.mustChangePassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = validateNewPassword(current, next, confirm);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      await learningApi.changePassword({ currentPassword: current, newPassword: next });
      // The server signs out every device after a password change, so finish locally and sign in again.
      await logout().catch(() => undefined);
      router.replace('/(auth)/login');
    } catch (failure) {
      const normalized = normalizeApiError(failure);
      setError(normalized.status === 401 ? 'Your current password is not correct.' : normalized.message);
      setBusy(false);
    }
  };

  return (
    <AppScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <AppText style={styles.title}>{forced ? 'Set your new password' : 'Change password'}</AppText>
          <AppText style={styles.muted}>
            {forced ? 'Your school gave you a temporary sign-in. Choose a password only you know to continue.' : 'You will be signed out on all devices after changing it.'}
          </AppText>
        </View>
        <PasswordInput label={forced ? 'Temporary password' : 'Current password'} value={current} onChangeText={setCurrent} autoCapitalize="none" textContentType="password" />
        <PasswordInput label="New password" value={next} onChangeText={setNext} autoCapitalize="none" textContentType="newPassword" />
        <PasswordInput label="Confirm new password" value={confirm} onChangeText={setConfirm} autoCapitalize="none" textContentType="newPassword" />
        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        <AppButton title="Save new password" loading={busy} disabled={busy || !current || !next || !confirm} onPress={() => void submit()} />
        {forced ? null : <AppButton title="Cancel" onPress={() => router.back()} />}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  header: { gap: spacing.xs },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 22 },
  error: { color: colors.danger },
});
