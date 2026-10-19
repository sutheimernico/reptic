import { useAppTheme } from '@/hooks/use-app-theme';

import { ArcadeTabBar } from './arcade';
import { EvolvedTabBar } from './evolved';
import { InstrumentTabBar } from './instrument';
import type { TabBarProps } from './shared';
import { WarmTabBar } from './warm';

/** Same props as the navigator's `tabBar` render prop; the theme variant picks the skin. */
export function TabBar(props: TabBarProps) {
  switch (useAppTheme().variant) {
    case 'warm':
      return <WarmTabBar {...props} />;
    case 'arcade':
      return <ArcadeTabBar {...props} />;
    case 'instrument':
      return <InstrumentTabBar {...props} />;
    default:
      return <EvolvedTabBar {...props} />;
  }
}
