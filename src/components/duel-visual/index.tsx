/**
 * The weekly duel in the active theme's own language: A twin bars, C tug-of-war,
 * D boss-fight HP bars, E split readout. One model feeds all four skins.
 */
import { useMemo } from 'react';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { WeekCard } from '@/domain/week-card';

import { ArcadeDuel } from './arcade';
import { EvolvedDuel } from './evolved';
import { InstrumentDuel } from './instrument';
import { duelModel } from './model';
import { WarmDuel } from './warm';

export function DuelVisual({
  me,
  friend,
  importedAt,
}: {
  me: WeekCard;
  friend: WeekCard;
  importedAt?: string;
}) {
  const { variant } = useAppTheme();
  const model = useMemo(() => duelModel(me, friend, importedAt), [me, friend, importedAt]);
  switch (variant) {
    case 'warm':
      return <WarmDuel model={model} />;
    case 'arcade':
      return <ArcadeDuel model={model} />;
    case 'instrument':
      return <InstrumentDuel model={model} />;
    default:
      return <EvolvedDuel model={model} />;
  }
}
