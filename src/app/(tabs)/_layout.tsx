import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(outline: IoniconName, filled: IoniconName) {
  const Icon = ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? filled : outline} color={color} size={size} />
  );
  Icon.displayName = `TabBarIcon-${outline}`;
  return Icon;
}

export default function TabsLayout() {
  const c = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Heute', tabBarIcon: tabIcon('today-outline', 'today') }}
      />
      <Tabs.Screen
        name="plans"
        options={{ title: 'Pläne', tabBarIcon: tabIcon('clipboard-outline', 'clipboard') }}
      />
      <Tabs.Screen
        name="exercises"
        options={{ title: 'Übungen', tabBarIcon: tabIcon('barbell-outline', 'barbell') }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'Verlauf', tabBarIcon: tabIcon('time-outline', 'time') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Einstellungen', tabBarIcon: tabIcon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
