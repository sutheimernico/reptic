/**
 * The Heute hero: this week's progress in the active theme's own language.
 * One model feeds all four skins, so they cannot show different numbers.
 */
import { useMemo } from 'react';

import type { WeekOverview } from '@/db';
import { useAppTheme } from '@/hooks/use-app-theme';

import { ArcadeHero } from './arcade';
import { EvolvedHero } from './evolved';
import { InstrumentHero } from './instrument';
import { heroModel } from './model';
import { WarmHero } from './warm';

export function WeekHero({ overview }: { overview: WeekOverview }) {
  const { variant } = useAppTheme();
  const model = useMemo(() => heroModel(overview), [overview]);
  switch (variant) {
    case 'warm':
      return <WarmHero model={model} />;
    case 'arcade':
      return <ArcadeHero model={model} />;
    case 'instrument':
      return <InstrumentHero model={model} />;
    default:
      return <EvolvedHero model={model} />;
  }
}
