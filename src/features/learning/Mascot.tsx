import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';

import type { MascotState } from '@/api/contracts/learning';
import { AppText } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';

/**
 * Approved mascot artwork is supplied separately. Register it here by `assetKey`; until then the
 * mascot renders as a neutral lamp-coloured badge with the mascot's initial. No third-party
 * character or trademarked artwork is used.
 */
export const MASCOT_ASSETS: Record<string, number> = {};

const DEFAULT_LINES: Record<MascotState, string> = {
  WELCOME: 'Welcome. Take a lesson whenever you are ready.',
  NEW_LESSON: 'A new lesson is waiting for you.',
  DAILY_TASK_AVAILABLE: "Today's quiz is ready for you.",
  SUCCESSFUL_COMPLETION: "Well done. That's today's quiz complete.",
  STREAK_MILESTONE: 'You have studied on many days in a row.',
  GENTLE_REMINDER: 'Your quiz is here whenever you would like to continue.',
};

interface MascotProps {
  name: string | null;
  state: MascotState;
  message: string | null;
  /** Learner or server preference. The device's reduce-motion setting is always honoured too. */
  reduceAnimations: boolean;
  assetKey: string | null;
}

export function Mascot({ name, state, message, reduceAnimations, assetKey }: MascotProps) {
  const [systemReduce, setSystemReduce] = useState(false);
  const [bounce] = useState(() => new Animated.Value(0));
  const animate = !reduceAnimations && !systemReduce;
  const hasAsset = Boolean(assetKey && MASCOT_ASSETS[assetKey] !== undefined);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setSystemReduce(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduce);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!animate) { bounce.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: -4, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animate, bounce, state]);

  const line = message ?? DEFAULT_LINES[state];
  return (
    <View accessible accessibilityLabel={`${name ?? 'Guide'} says: ${line}`} style={styles.row}>
      <Animated.View style={[styles.badge, { transform: [{ translateY: bounce }] }]}>
        {hasAsset && assetKey ? (
          <Image accessibilityIgnoresInvertColors source={MASCOT_ASSETS[assetKey]} style={styles.image} />
        ) : (
          <AppText style={styles.initial}>{(name ?? 'E').slice(0, 1).toUpperCase()}</AppText>
        )}
      </Animated.View>
      <View style={styles.bubble}>
        {name ? <AppText style={styles.name}>{name}</AppText> : null}
        <AppText style={styles.line}>{line}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  badge: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 999, height: 56, justifyContent: 'center', width: 56 },
  image: { borderRadius: 999, height: 56, width: 56 },
  initial: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  bubble: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, gap: 2, padding: spacing.md },
  name: { color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  line: { color: colors.text, lineHeight: 22 },
});
