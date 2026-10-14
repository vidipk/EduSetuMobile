import { Tabs } from 'expo-router';
import { Bell, Home, User, Users, type LucideIcon } from 'lucide-react-native';
import type { ColorValue } from 'react-native';

const tabIcon = (Icon: LucideIcon) => function TabIcon({ color, size }: { color: ColorValue; size: number }) {
  return <Icon color={String(color)} size={size} />;
};

export default function ParentTabs() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#035352' }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon(Home) }} />
    <Tabs.Screen name="child" options={{ title: 'Child', tabBarIcon: tabIcon(Users) }} />
    <Tabs.Screen name="notices" options={{ title: 'Notices', tabBarIcon: tabIcon(Bell) }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(User) }} />
  </Tabs>;
}
