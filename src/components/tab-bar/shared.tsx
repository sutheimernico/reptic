import type { Tabs } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export interface TabItem {
  key: string;
  /** The plain German title — also the accessibility name, whatever the skin prints. */
  title: string;
  focused: boolean;
  icon: (color: string, size: number) => ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}

/** Flattens react-navigation's state/descriptors into what the skins need, keeping its press semantics. */
export function tabItems({ state, descriptors, navigation }: TabBarProps): TabItem[] {
  return state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    return {
      key: route.key,
      title: options.title ?? route.name,
      focused,
      icon: (color, size) => options.tabBarIcon?.({ focused, color, size }) ?? null,
      onPress: () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
      },
      onLongPress: () => navigation.emit({ type: 'tabLongPress', target: route.key }),
    };
  });
}
