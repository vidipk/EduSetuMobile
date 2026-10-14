import { Tabs } from 'expo-router';
import { Home, Inbox, PlusCircle, User, Users, type LucideIcon } from 'lucide-react-native';
import type { ColorValue } from 'react-native';

const tabIcon = (Icon: LucideIcon) => function TabIcon({ color, size }: { color: ColorValue; size: number }) {
  return <Icon color={String(color)} size={size} />;
};

export default function TeacherTabs() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#035352' }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon(Home) }} />
    <Tabs.Screen name="classes" options={{ title: 'Classes', tabBarIcon: tabIcon(Users) }} />
    <Tabs.Screen name="action" options={{ title: 'Action', tabBarIcon: tabIcon(PlusCircle) }} />
    <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: tabIcon(Inbox) }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(User) }} />
  </Tabs>;
}
