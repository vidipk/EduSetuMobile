import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { ArrowLeft, ArrowRight, Bell, ChevronRight, Search, type LucideIcon } from 'lucide-react-native';

import { useVeralayamFonts } from './fonts';
import { subjectPalettes, vColors, vFont, vRadius, vShadow, vSpace } from './tokens';
import { useUnreadNotices } from './unread-store';

type Weight = keyof typeof vFont;

export function VText({ weight = 'regular', style, ...rest }: TextProps & { weight?: Weight }) {
  return <Text allowFontScaling style={[{ color: vColors.ink, fontFamily: vFont[weight] }, style]} {...rest} />;
}

/** Page shell: mint background, safe area, gutter, optional pull-to-refresh. Loads Inter without blocking. */
export function VScreen({ children, onRefresh, refreshing = false, scroll = true, contentStyle }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; scroll?: boolean; contentStyle?: StyleProp<ViewStyle>;
}) {
  useVeralayamFonts();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, contentStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vColors.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>}
    </SafeAreaView>
  );
}

/** Persistent notification bell. The dot appears only when the server reports unread notices. */
export function VBell() {
  const unread = useUnreadNotices((state) => state.count);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      onPress={() => router.push('/(student)/(tabs)/notices' as Href)}
      style={styles.bell}
    >
      <Bell color={vColors.ink} size={20} />
      {unread > 0 ? <View style={styles.bellDot} /> : null}
    </Pressable>
  );
}

export function VHeader({ eyebrow, title, subtitle, onBack, bell = true, titleSize = 28 }: {
  eyebrow?: string; title: string; subtitle?: string; onBack?: () => void; bell?: boolean; titleSize?: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.back}>
            <ArrowLeft color={vColors.ink} size={20} />
          </Pressable>
        ) : null}
        <View style={styles.headerTitles}>
          {eyebrow ? <VText weight="bold" style={styles.eyebrow} numberOfLines={1}>{eyebrow}</VText> : null}
          <VText accessibilityRole="header" weight="extrabold" style={[styles.title, { fontSize: titleSize, lineHeight: titleSize + 6 }]}>{title}</VText>
        </View>
        {bell ? <VBell /> : null}
      </View>
      {subtitle ? <VText style={styles.subtitle}>{subtitle}</VText> : null}
    </View>
  );
}

export function VSearch(props: TextInputProps) {
  return (
    <View style={styles.search}>
      <View style={styles.searchIcon}><Search color={vColors.primary} size={18} /></View>
      <TextInput accessibilityLabel="Search" placeholderTextColor={vColors.muted} returnKeyType="search" style={styles.searchInput} {...props} />
    </View>
  );
}

export function VSectionHeader({ title, trailing, accent = false }: { title: string; trailing?: string; accent?: boolean }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionTitleRow}>
        {accent ? <View style={styles.accent} /> : null}
        <VText accessibilityRole="header" weight="bold" style={styles.sectionTitle}>{title}</VText>
      </View>
      {trailing ? <VText weight="semibold" style={styles.sectionTrailing}>{trailing}</VText> : null}
    </View>
  );
}

export function VCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * Editorial subject card. Fixed internal layout (eyebrow, wrapped title, tagline, action) with a decorative
 * artwork block; long titles wrap to at most three lines inside the same card, never resizing it.
 */
export function VSubjectCard({ index, title, tagline, meta, Icon, actionLabel = 'Open subject', onPress }: {
  index: number; title: string; tagline?: string | null; meta?: string; Icon: LucideIcon; actionLabel?: string; onPress: () => void;
}) {
  const palette = subjectPalettes[index % subjectPalettes.length];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${actionLabel}`} onPress={onPress} style={[styles.subjectCard, { backgroundColor: palette.bg }]}>
      <View style={[styles.artCircle, { borderColor: palette.accent }]} />
      <View style={[styles.artTile, { backgroundColor: vColors.surface }]}><Icon color={palette.accent} size={34} /></View>
      <View style={styles.subjectText}>
        <VText weight="bold" style={[styles.subjectEyebrow, { color: palette.accent }]}>{String(index + 1).padStart(2, '0')} / EXPLORE</VText>
        <VText weight="extrabold" numberOfLines={3} style={[styles.subjectTitle, { color: palette.accent }]}>{title}</VText>
        {tagline ? <VText numberOfLines={2} style={styles.subjectTagline}>{tagline}</VText> : null}
        {meta ? <VText weight="medium" numberOfLines={1} style={styles.subjectMeta}>{meta}</VText> : null}
      </View>
      <View style={styles.subjectAction}>
        <VText weight="bold" style={[styles.subjectActionText, { color: palette.accent }]}>{actionLabel}</VText>
        <ArrowRight color={palette.accent} size={16} />
      </View>
    </Pressable>
  );
}

export function VRowCard({ Icon, tone = 'mint', title, subtitle, trailing, onPress, disabled, badge }: {
  Icon: LucideIcon; tone?: 'mint' | 'blue' | 'amber' | 'violet'; title: string; subtitle?: string | null; trailing?: string; onPress?: () => void; disabled?: boolean; badge?: string;
}) {
  const bg = { mint: vColors.mint, blue: vColors.blueSoft, amber: vColors.amberSoft, violet: vColors.violetSoft }[tone];
  const fg = { mint: vColors.primary, blue: vColors.blue, amber: vColors.amber, violet: vColors.violet }[tone];
  const body = (
    <View style={[styles.rowCard, disabled && styles.rowDisabled]}>
      <View style={styles.rowAccent} />
      <View style={[styles.rowIcon, { backgroundColor: bg }]}><Icon color={fg} size={22} /></View>
      <View style={styles.rowText}>
        {badge ? <VText weight="bold" style={styles.rowBadge}>{badge}</VText> : null}
        <VText weight="bold" numberOfLines={3} style={styles.rowTitle}>{title}</VText>
        {subtitle ? <VText numberOfLines={2} style={styles.rowSubtitle}>{subtitle}</VText> : null}
      </View>
      {trailing ? <VText weight="semibold" style={styles.rowTrailing}>{trailing}</VText> : onPress && !disabled ? <ChevronRight color={vColors.primary} size={20} /> : null}
    </View>
  );
  if (!onPress || disabled) return <View accessibilityState={{ disabled: true }}>{body}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>{body}</Pressable>;
}

/** Two-up resource tile as in "Learning resources" (Videos / Notes). A tile without content is disabled and says so. */
export function VResourceTile({ Icon, tone, title, subtitle, onPress, disabled }: {
  Icon: LucideIcon; tone: 'mint' | 'violet'; title: string; subtitle: string; onPress?: () => void; disabled?: boolean;
}) {
  const bg = tone === 'mint' ? vColors.mint : vColors.violetSoft;
  const fg = tone === 'mint' ? vColors.primary : vColors.violet;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={`${title}. ${subtitle}`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tile, disabled && styles.rowDisabled]}
    >
      <View style={[styles.tileIcon, { backgroundColor: bg }]}><Icon color={fg} size={22} /></View>
      <View style={styles.tileText}>
        <VText weight="bold" style={styles.tileTitle} numberOfLines={1}>{title}</VText>
        <VText style={styles.tileSubtitle} numberOfLines={2}>{subtitle}</VText>
      </View>
    </Pressable>
  );
}

export function VLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <View accessibilityLabel={label} style={styles.state}>
      <ActivityIndicator color={vColors.primary} />
      <VText style={styles.stateText}>{label}</VText>
    </View>
  );
}

export function VEmpty({ title, detail, Icon }: { title: string; detail?: string; Icon?: LucideIcon }) {
  return (
    <View style={[styles.state, styles.emptyCard]}>
      {Icon ? <View style={styles.emptyIcon}><Icon color={vColors.primary} size={22} /></View> : null}
      <VText weight="bold" style={styles.emptyTitle}>{title}</VText>
      {detail ? <VText style={styles.stateText}>{detail}</VText> : null}
    </View>
  );
}

export function VError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={[styles.state, styles.emptyCard]}>
      <VText weight="bold" style={styles.emptyTitle}>We couldn&apos;t load this</VText>
      <VText style={styles.stateText}>{message}</VText>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <VText weight="bold" style={styles.retryText}>Try again</VText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function VPill({ label, tone = 'mint', style }: { label: string; tone?: 'mint' | 'amber' | 'blue' | 'danger'; style?: StyleProp<TextStyle> }) {
  const map = { mint: [vColors.mint, vColors.primary], amber: [vColors.amberSoft, vColors.amber], blue: [vColors.blueSoft, vColors.blue], danger: ['#FDE7E4', vColors.danger] } as const;
  const [bg, fg] = map[tone];
  return <VText weight="bold" style={[styles.pill, { backgroundColor: bg, color: fg }, style]}>{label}</VText>;
}

export const vStyles = { gutter: vSpace.gutter, gap: vSpace.gap };

const styles = StyleSheet.create({
  screen: { backgroundColor: vColors.page, flex: 1 },
  content: { gap: vSpace.section, paddingBottom: 40, paddingHorizontal: vSpace.gutter, paddingTop: 12 },
  fill: { flex: 1 },
  header: { gap: 6 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  headerTitles: { flex: 1, gap: 2 },
  eyebrow: { color: vColors.primary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: vColors.ink },
  subtitle: { color: vColors.muted, fontSize: 14, lineHeight: 20 },
  bell: { alignItems: 'center', backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: 16, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  bellDot: { backgroundColor: '#E8833A', borderColor: vColors.surface, borderRadius: 5, borderWidth: 1.5, height: 10, position: 'absolute', right: 9, top: 9, width: 10 },
  back: { alignItems: 'center', backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: 16, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  search: { alignItems: 'center', backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.tile, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 52, paddingHorizontal: 8 },
  searchIcon: { alignItems: 'center', backgroundColor: vColors.mint, borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  searchInput: { color: vColors.ink, flex: 1, fontFamily: vFont.regular, fontSize: 14, minHeight: 44 },
  sectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitleRow: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 8 },
  accent: { backgroundColor: vColors.primary, borderRadius: 2, height: 22, width: 3 },
  sectionTitle: { color: vColors.ink, fontSize: 20 },
  sectionTrailing: { color: vColors.muted, fontSize: 12 },
  card: { backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.card, borderWidth: 1, padding: 16, ...vShadow },
  subjectCard: { borderRadius: 24, minHeight: 168, overflow: 'hidden', padding: 20 },
  artCircle: { borderRadius: 70, borderWidth: 14, height: 140, opacity: 0.14, position: 'absolute', right: -30, top: 10, width: 140 },
  artTile: { alignItems: 'center', borderRadius: 18, height: 76, justifyContent: 'center', position: 'absolute', right: 22, top: 40, transform: [{ rotate: '8deg' }], width: 64, ...vShadow },
  subjectText: { gap: 4, paddingRight: 96 },
  subjectEyebrow: { fontSize: 11, letterSpacing: 1 },
  subjectTitle: { fontSize: 24, lineHeight: 29 },
  subjectTagline: { color: vColors.body, fontSize: 13, lineHeight: 18 },
  subjectMeta: { color: vColors.body, fontSize: 12 },
  subjectAction: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: vColors.surface, borderRadius: 12, flexDirection: 'row', gap: 8, marginTop: 16, minHeight: 36, paddingHorizontal: 14 },
  subjectActionText: { fontSize: 13 },
  rowCard: { alignItems: 'center', backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.card, borderWidth: 1, flexDirection: 'row', gap: 12, overflow: 'hidden', padding: 14, paddingLeft: 18, ...vShadow },
  rowAccent: { backgroundColor: vColors.primary, bottom: 0, left: 0, position: 'absolute', top: 0, width: 3 },
  rowDisabled: { opacity: 0.55 },
  rowIcon: { alignItems: 'center', borderRadius: 14, height: 46, justifyContent: 'center', width: 46 },
  rowText: { flex: 1, gap: 2 },
  rowBadge: { color: vColors.primary, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  rowTitle: { color: vColors.ink, fontSize: 16, lineHeight: 22 },
  rowSubtitle: { color: vColors.muted, fontSize: 13, lineHeight: 18 },
  rowTrailing: { color: vColors.primary, fontSize: 12 },
  tile: { alignItems: 'center', backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.card, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 10, minHeight: 72, padding: 12 },
  tileIcon: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  tileText: { flex: 1 },
  tileTitle: { fontSize: 15 },
  tileSubtitle: { color: vColors.muted, fontSize: 12, lineHeight: 16 },
  state: { alignItems: 'center', gap: 8, padding: 24 },
  stateText: { color: vColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyCard: { backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.card, borderWidth: 1 },
  emptyIcon: { alignItems: 'center', backgroundColor: vColors.mint, borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  emptyTitle: { fontSize: 16, textAlign: 'center' },
  retry: { backgroundColor: vColors.primary, borderRadius: 12, justifyContent: 'center', marginTop: 4, minHeight: 44, paddingHorizontal: 20 },
  retryText: { color: '#fff', fontSize: 14 },
  pill: { alignSelf: 'flex-start', borderRadius: vRadius.pill, fontSize: 11, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 },
});
