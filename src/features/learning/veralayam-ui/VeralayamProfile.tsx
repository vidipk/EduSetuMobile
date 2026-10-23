import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Building2, ChevronRight, KeyRound, LogOut, Mail, Sparkles } from 'lucide-react-native';

import { learningApi } from '@/api/academics/learning';
import { useAuth } from '@/auth/AuthProvider';
import { useRemoteData } from '@/features/performance/use-remote-data';

import { useLearningExperience } from '../experience-store';
import { VStrip } from './blocks';
import { VCard, VHeader, VScreen, VSectionHeader, VText } from './components';
import { vColors, vRadius, vShadow } from './tokens';

export function initialsOf(name: string | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}

/** Figma "Profile V2". Only the authenticated user's real details are shown; no programme or certification status is invented. */
export function VeralayamProfile() {
  const { user, logout } = useAuth();
  const mascot = useLearningExperience((state) => state.config?.mascot.enabled ?? false);
  const home = useRemoteData(user ? `learning-home:${user.id}` : null, () => learningApi.home());
  const [reduceOverride, setReduceOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const className = home.data?.learner.className ?? null;
  const reduce = reduceOverride ?? home.data?.mascot.reduceAnimations ?? false;

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await logout();
    } catch {
      setError('You were signed out on this device. Open the app again to continue.');
    } finally {
      setBusy(false);
      router.replace('/(auth)/login');
    }
  };

  const toggleReduce = (value: boolean) => {
    setReduceOverride(value);
    void learningApi.setReduceAnimations(value).catch(() => setReduceOverride(null));
  };

  return (
    <VScreen>
      <VHeader eyebrow="Student account" title="My profile" subtitle="A little space that's all yours." />

      <VCard style={styles.identity}>
        <View style={styles.identityTop}>
          <View accessibilityLabel="Profile initials" style={styles.avatar}><VText weight="extrabold" style={styles.avatarText}>{initialsOf(user?.fullName)}</VText></View>
          <View style={{ flex: 1, gap: 4 }}>
            <VText weight="bold" style={styles.badge}>Student</VText>
            <VText accessibilityRole="header" weight="extrabold" numberOfLines={2} style={{ fontSize: 22, lineHeight: 28 }}>{user?.fullName ?? 'Student'}</VText>
            {className ? <VText style={{ color: vColors.muted, fontSize: 13 }}>Class {className}</VText> : null}
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.icon}><Building2 color={vColors.primary} size={20} /></View>
          <View style={{ flex: 1 }}>
            <VText weight="bold" style={styles.small}>Your school</VText>
            <VText weight="semibold" style={{ fontSize: 16 }}>{user?.organization?.name ?? 'Your institution'}</VText>
          </View>
        </View>
      </VCard>

      <View style={{ gap: 12 }}>
        <VSectionHeader title="Account & preferences" />
        <VCard style={{ padding: 0 }}>
          <View style={styles.row}>
            <View style={styles.icon}><Mail color={vColors.primary} size={20} /></View>
            <View style={{ flex: 1 }}>
              <VText style={styles.small}>Email address</VText>
              <VText weight="semibold" style={{ fontSize: 15 }} numberOfLines={1}>{user?.email ?? 'Not available'}</VText>
            </View>
          </View>
          <View style={styles.hair} />
          <Pressable accessibilityRole="button" accessibilityLabel="Change password" onPress={() => router.push('/(student)/change-password' as Href)} style={styles.row}>
            <View style={[styles.icon, { backgroundColor: vColors.violetSoft }]}><KeyRound color={vColors.violet} size={20} /></View>
            <View style={{ flex: 1 }}>
              <VText weight="semibold" style={{ fontSize: 15 }}>Change password</VText>
              <VText style={styles.small}>Keep your account secure</VText>
            </View>
            <ChevronRight color={vColors.primary} size={20} />
          </Pressable>
          {mascot ? (
            <>
              <View style={styles.hair} />
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: vColors.amberSoft }]}><Sparkles color={vColors.amber} size={20} /></View>
                <View style={{ flex: 1 }}>
                  <VText weight="semibold" style={{ fontSize: 15 }}>Reduce animations</VText>
                  <VText style={styles.small}>Keeps the guide still</VText>
                </View>
                <Switch accessibilityLabel="Reduce animations" value={reduce} onValueChange={toggleReduce} />
              </View>
            </>
          ) : null}
        </VCard>
        <VStrip Icon={KeyRound} text="Forgot your password? Ask your institution administrator for a new activation link." />
      </View>

      {error ? <VText accessibilityRole="alert" style={{ color: vColors.danger }}>{error}</VText> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Log out" disabled={busy} onPress={() => void signOut()} style={[styles.logout, busy && { opacity: 0.6 }]}>
        <LogOut color={vColors.danger} size={20} />
        <VText weight="bold" style={{ color: vColors.danger, flex: 1, fontSize: 15 }}>Log out</VText>
        <ChevronRight color={vColors.danger} size={20} />
      </Pressable>
    </VScreen>
  );
}

const styles = StyleSheet.create({
  identity: { gap: 14, padding: 18 },
  identityTop: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  avatar: { alignItems: 'center', backgroundColor: vColors.primary, borderColor: vColors.mint, borderRadius: 36, borderWidth: 4, height: 72, justifyContent: 'center', width: 72 },
  avatarText: { color: '#fff', fontSize: 24 },
  badge: { alignSelf: 'flex-start', backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: 8, borderWidth: 1, color: vColors.ink, fontSize: 11, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 2 },
  divider: { backgroundColor: vColors.border, height: 1 },
  hair: { backgroundColor: vColors.border, height: 1, marginHorizontal: 16 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 64, padding: 14 },
  icon: { alignItems: 'center', backgroundColor: vColors.mint, borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  small: { color: vColors.muted, fontSize: 12 },
  logout: { alignItems: 'center', backgroundColor: vColors.surface, borderColor: '#F1C7C2', borderRadius: vRadius.card, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 56, paddingHorizontal: 18, ...vShadow },
});
