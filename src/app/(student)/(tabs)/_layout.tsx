import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Bell, BookOpen, ClipboardList, Home, User, type LucideIcon } from 'lucide-react-native';
import type { ColorValue } from 'react-native';

import { useInstitutionExperience } from '@/features/learning/experience-store';
import { useUnreadNotices } from '@/features/learning/veralayam-ui/unread-store';
import { VeralayamTabBar } from '@/features/learning/veralayam-ui/VeralayamTabBar';

const tabIcon = (Icon: LucideIcon) => function TabIcon({ color, size }: { color: ColorValue; size: number }) {
  return <Icon color={String(color)} size={size} />;
};

export default function StudentTabs() {
  const institution = useInstitutionExperience();
  const loadUnread = useUnreadNotices((state) => state.load);
  useEffect(() => { if (institution) void loadUnread(); }, [institution, loadUnread]);

  // Standard schools keep the original five tabs; the institution experience swaps in the four-tab bar and
  // keeps Notices as a hidden route that the persistent bell opens.
  return <Tabs tabBar={institution ? (props) => <VeralayamTabBar {...props} /> : undefined} screenOptions={{ headerShown: false, tabBarActiveTintColor: '#035352' }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon(Home) }} />
    <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: tabIcon(BookOpen) }} />
    <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: tabIcon(ClipboardList) }} />
    <Tabs.Screen name="notices" options={{ title: 'Notices', tabBarIcon: tabIcon(Bell), ...(institution ? { href: null } : {}) }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(User) }} />
  </Tabs>;
}
