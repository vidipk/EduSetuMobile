import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { router } from 'expo-router';

import { AppButton, AppCard, AppScreen, AppText } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';

import { statusLabel, statusTone } from './logic';

export function FormScroll({ children, refreshing, onRefresh, testID }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; testID?: string }) {
  return (
    <AppScreen style={{ padding: 0 }}>
      <ScrollView
        testID={testID}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} colors={[colors.primary]} /> : undefined}
      >
        {children}
      </ScrollView>
    </AppScreen>
  );
}

export function BackButton({ title = 'Back' }: { title?: string }) {
  return <AppButton title={title} onPress={() => router.back()} />;
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <View style={styles.heading}>
      <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
      {subtitle ? <AppText style={styles.muted}>{subtitle}</AppText> : null}
    </View>
  );
}

export function Field({ label, error, hint, ...input }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, input.multiline && styles.inputMultiline, error ? styles.inputError : null]}
        textAlignVertical={input.multiline ? 'top' : 'center'}
        {...input}
      />
      {hint ? <AppText style={styles.hint}>{hint}</AppText> : null}
      {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
    </View>
  );
}

/** Status is always spelled out in text, never colour alone. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  return (
    <View accessible accessibilityLabel={`Status: ${label ?? statusLabel(status)}`} style={[styles.badge, toneStyles[tone]]}>
      <AppText style={[styles.badgeText, toneText[tone]]}>{label ?? statusLabel(status)}</AppText>
    </View>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.skeletonList}>
      {Array.from({ length: rows }, (_, index) => (
        <AppCard key={index} style={styles.skeletonCard}>
          <View style={[styles.skeletonLine, { width: '60%' }]} />
          <View style={[styles.skeletonLine, { width: '40%' }]} />
          <View style={[styles.skeletonLine, { width: '80%' }]} />
        </AppCard>
      ))}
    </View>
  );
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <View accessibilityRole="alert" style={styles.errorBox}>
      {errors.map((message) => <AppText key={message} style={styles.error}>• {message}</AppText>)}
    </View>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

const toneStyles = StyleSheet.create({
  success: { backgroundColor: '#E1F3EA' },
  warning: { backgroundColor: colors.accent },
  info: { backgroundColor: '#E3EDF9' },
  muted: { backgroundColor: '#E6ECEB' },
  danger: { backgroundColor: '#FBE4E1' },
});
const toneText = StyleSheet.create({
  success: { color: '#0B5A39' },
  warning: { color: '#5B4300' },
  info: { color: '#1B4B86' },
  muted: { color: colors.text },
  danger: { color: colors.danger },
});

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.xs },
  title: { fontSize: 24, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 20 },
  field: { gap: spacing.xs },
  label: { fontWeight: '700', fontSize: 14 },
  input: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  inputMultiline: { minHeight: 96 },
  inputError: { borderColor: colors.danger },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, lineHeight: 20 },
  errorBox: { backgroundColor: '#FBE4E1', borderRadius: radius.md, gap: spacing.xs, padding: spacing.md },
  badge: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  skeletonList: { gap: spacing.md },
  skeletonCard: { gap: spacing.sm },
  skeletonLine: { backgroundColor: '#E6ECEB', borderRadius: radius.sm, height: 14 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
