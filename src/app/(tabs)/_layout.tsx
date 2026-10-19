import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { TabBar } from '@/components/tab-bar';
import { useAppTheme } from '@/hooks/use-app-theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(outline: IoniconName, filled: IoniconName) {
  const Icon = ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? filled : outline} color={color} size={size} />
  );
  Icon.displayName = `TabBarIcon-${outline}`;
  return Icon;
}

export default function TabsLayout() {
  const { colors: c, variant } = useAppTheme();
  const reducedMotion = useReducedMotion();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Screens cross-fade on a tab switch; arcade slides, to match its bouncier feel. No transition with reduced motion.
        animation: reducedMotion ? 'none' : variant === 'arcade' ? 'shift' : 'fade',
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
