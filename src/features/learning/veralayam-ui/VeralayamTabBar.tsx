import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import { BookOpen, ClipboardList, Home, User, type LucideIcon } from 'lucide-react-native';

import { VText } from './components';
import { vColors } from './tokens';

type TabBarRenderer = NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>;
export type BottomTabBarProps = Parameters<TabBarRenderer>[0];

const TABS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: 'index', label: 'Home', Icon: Home },
  { name: 'learn', label: 'Learn', Icon: BookOpen },
  { name: 'tasks', label: 'Tasks', Icon: ClipboardList },
  { name: 'profile', label: 'Profile', Icon: User },
];

/** Four-tab Figma bar. Notices is reached from the bell, so it is never listed here. */
export function VeralayamTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map(({ name, label, Icon }) => {
        const route = state.routes.find((item) => item.name === name);
        if (!route) return null;
        const focused = activeName === name;
        const color = focused ? vColors.primary : vColors.muted;
        return (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={styles.item}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <Icon color={color} size={22} />
              <VText weight={focused ? 'bold' : 'medium'} style={[styles.label, { color }]}>{label}</VText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: vColors.surface, borderTopColor: vColors.border, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8 },
  item: { alignItems: 'center', flex: 1, minHeight: 52 },
  pill: { alignItems: 'center', borderRadius: 18, gap: 2, minWidth: 64, paddingHorizontal: 12, paddingVertical: 6 },
  pillActive: { backgroundColor: vColors.mint },
  label: { fontSize: 11 },
});
