import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowRight, ChevronRight, type LucideIcon } from 'lucide-react-native';

import { VText } from './components';
import { vColors, vRadius, vShadow } from './tokens';

/** Dark-teal "Today's focus" card from Home V2. The artwork block is a decorative placeholder, not exported Figma art. */
export function VFocusCard({ chip, title, detail, actionLabel, onAction, Icon, art }: {
  chip: string; title: string; detail?: string | null; actionLabel: string; onAction: () => void; Icon: LucideIcon; art?: ReactNode;
}) {
  return (
    <View style={styles.focus}>
      <View style={styles.focusCircle} />
      {/* Same slot as the decorative tile: the mascot replaces it (never adds content), so layout and CTA do not move. */}
      <View style={styles.focusArt}>{art ?? <Icon color={vColors.primary} size={34} />}</View>
      <View style={styles.focusChip}><VText weight="bold" style={styles.focusChipText}>{chip}</VText></View>
      <VText accessibilityRole="header" weight="extrabold" numberOfLines={3} style={styles.focusTitle}>{title}</VText>
      {detail ? <VText numberOfLines={2} style={styles.focusDetail}>{detail}</VText> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.focusButton}>
        <VText weight="bold" style={styles.focusButtonText}>{actionLabel}</VText>
        <ArrowRight color={vColors.primary} size={16} />
      </Pressable>
    </View>
  );
}

export function VMetricTile({ Icon, value, label, hint, bar }: { Icon: LucideIcon; value: string; label: string; hint?: string; bar?: number | null }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}><Icon color={vColors.primary} size={18} /></View>
      <VText weight="extrabold" style={styles.metricValue} adjustsFontSizeToFit numberOfLines={1}>{value}</VText>
      <VText weight="semibold" style={styles.metricLabel}>{label}</VText>
      {hint ? <VText style={styles.metricHint} numberOfLines={2}>{hint}</VText> : null}
      {bar !== undefined && bar !== null ? <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, bar))}%` }]} /></View> : null}
    </View>
  );
}

export function VLinkCard({ Icon, title, detail, onPress }: { Icon: LucideIcon; title: string; detail?: string | null; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.linkCard}>
      <View style={styles.linkIcon}><Icon color={vColors.primary} size={22} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <VText weight="bold" style={{ fontSize: 16 }}>{title}</VText>
        {detail ? <VText numberOfLines={2} style={{ color: vColors.muted, fontSize: 13, lineHeight: 18 }}>{detail}</VText> : null}
      </View>
      <ChevronRight color={vColors.primary} size={20} />
    </Pressable>
  );
}

export function VStrip({ Icon, text, tone = 'mint', onPress }: { Icon: LucideIcon; text: string; tone?: 'mint' | 'amber'; onPress?: () => void }) {
  const amber = tone === 'amber';
  const body = (
    <View style={[styles.strip, { backgroundColor: amber ? vColors.amberSoft : vColors.mint }]}>
      <Icon color={amber ? vColors.amber : vColors.primary} size={18} />
      <VText weight="semibold" numberOfLines={2} style={{ color: amber ? vColors.amber : vColors.primary, flex: 1, fontSize: 13 }}>{text}</VText>
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable> : body;
}

/** Segmented switcher (Tasks V2). */
export function VSegment<T extends string>({ options, value, onChange }: { options: { id: T; label: string; count?: number; Icon?: LucideIcon }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map(({ id, label, count, Icon }) => {
        const active = id === value;
        return (
          <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={() => onChange(id)} style={[styles.segmentItem, active && styles.segmentActive]}>
            {Icon ? <Icon color={active ? '#fff' : vColors.muted} size={16} /> : null}
            <VText weight="bold" numberOfLines={1} style={{ color: active ? '#fff' : vColors.muted, fontSize: 13 }}>{label}</VText>
            {count !== undefined ? <VText weight="bold" style={[styles.count, active && styles.countActive]}>{count}</VText> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** One entry on the vertical task timeline. */
export function VTimelineItem({ badge, badgeTone, tag, title, meta, MetaIcon, onPress, last, done }: {
  badge: string; badgeTone: 'amber' | 'mint' | 'blue' | 'danger'; tag?: string | null; title: string; meta?: string; MetaIcon?: LucideIcon; onPress?: () => void; last?: boolean; done?: boolean;
}) {
  const colorMap = { amber: [vColors.amberSoft, vColors.amber], mint: [vColors.mint, vColors.primary], blue: [vColors.blueSoft, vColors.blue], danger: ['#FDE7E4', vColors.danger] } as const;
  const [bg, fg] = colorMap[badgeTone];
  const content: ReactNode = (
    <View style={[styles.timelineCard, done && { opacity: 0.85 }]}>
      <View style={[styles.rowAccent, { backgroundColor: fg }]} />
      <View style={styles.timelineTop}>
        <VText weight="bold" style={[styles.badge, { backgroundColor: bg, color: fg }]}>{badge}</VText>
        {tag ? <VText weight="semibold" numberOfLines={1} style={styles.tag}>{tag}</VText> : null}
      </View>
      <VText weight="bold" numberOfLines={3} style={styles.timelineTitle}>{title}</VText>
      <View style={styles.timelineBottom}>
        {meta ? <View style={styles.metaRow}>{MetaIcon ? <MetaIcon color={vColors.muted} size={14} /> : null}<VText style={styles.metaText} numberOfLines={1}>{meta}</VText></View> : <View />}
        {onPress ? <View style={styles.go}><ArrowRight color={vColors.primary} size={18} /></View> : null}
      </View>
    </View>
  );
  return (
    <View style={styles.timelineRow}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: done ? vColors.primary : vColors.amber }]} />
        {!last ? <View style={styles.line} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        {onPress ? <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>{content}</Pressable> : content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  focus: { backgroundColor: vColors.primary, borderRadius: 24, gap: 10, overflow: 'hidden', padding: 20 },
  focusCircle: { backgroundColor: '#FFFFFF', borderRadius: 80, height: 160, opacity: 0.07, position: 'absolute', right: -40, top: -30, width: 160 },
  focusArt: { alignItems: 'center', backgroundColor: '#E3F1EC', borderRadius: 18, height: 76, justifyContent: 'center', position: 'absolute', right: 20, top: 56, transform: [{ rotate: '8deg' }], width: 64 },
  focusChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: vRadius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  focusChipText: { color: '#E3F1EC', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  focusTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, paddingRight: 84 },
  focusDetail: { color: '#CFE5DE', fontSize: 13, lineHeight: 18, paddingRight: 84 },
  focusButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 14, flexDirection: 'row', gap: 8, marginTop: 6, minHeight: 44, paddingHorizontal: 18 },
  focusButtonText: { color: vColors.primary, fontSize: 14 },
  metric: { backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.card, borderWidth: 1, flex: 1, gap: 4, padding: 16, ...vShadow },
  metricIcon: { alignItems: 'center', backgroundColor: vColors.mint, borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  metricValue: { fontSize: 28, marginTop: 6 },
  metricLabel: { color: vColors.ink, fontSize: 13 },
  metricHint: { color: vColors.muted, fontSize: 12, lineHeight: 16 },
  track: { backgroundColor: vColors.border, borderRadius: 3, height: 5, marginTop: 6, overflow: 'hidden' },
  fill: { backgroundColor: vColors.primary, borderRadius: 3, height: 5 },
  linkCard: { alignItems: 'center', backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.card, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16, ...vShadow },
  linkIcon: { alignItems: 'center', backgroundColor: vColors.mint, borderRadius: 14, height: 46, justifyContent: 'center', width: 46 },
  strip: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 10, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10 },
  segment: { backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', padding: 4 },
  segmentItem: { alignItems: 'center', borderRadius: 14, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 44, paddingHorizontal: 6 },
  segmentActive: { backgroundColor: vColors.primary },
  count: { backgroundColor: vColors.mint, borderRadius: 10, color: vColors.primary, fontSize: 11, minWidth: 20, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 1, textAlign: 'center' },
  countActive: { backgroundColor: 'rgba(255,255,255,0.22)', color: '#fff' },
  timelineRow: { flexDirection: 'row', gap: 10 },
  rail: { alignItems: 'center', paddingTop: 18, width: 14 },
  dot: { borderRadius: 5, height: 10, width: 10 },
  line: { backgroundColor: vColors.border, flex: 1, marginTop: 4, width: 2 },
  rowAccent: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 3 },
  timelineCard: { backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.card, borderWidth: 1, gap: 8, marginBottom: 12, overflow: 'hidden', padding: 14, paddingLeft: 18, ...vShadow },
  timelineTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  badge: { borderRadius: 8, fontSize: 10, letterSpacing: 0.6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, textTransform: 'uppercase' },
  tag: { backgroundColor: vColors.page, borderColor: vColors.border, borderRadius: 8, borderWidth: 1, color: vColors.body, fontSize: 11, maxWidth: '55%', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  timelineTitle: { fontSize: 17, lineHeight: 23 },
  timelineBottom: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  metaRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6 },
  metaText: { color: vColors.muted, flexShrink: 1, fontSize: 13 },
  go: { alignItems: 'center', backgroundColor: vColors.mint, borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
});

