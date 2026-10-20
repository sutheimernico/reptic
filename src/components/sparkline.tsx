/**
 * A tiny trend line for list rows: no axes, no labels, the last point marked.
 * The value range gets a floor so a 2.5 kg step does not look like a cliff.
 */

import Svg, { Circle, Path } from 'react-native-svg';

import { useAppTheme } from '@/hooks/use-app-theme';

const MIN_RANGE = 10;

export function Sparkline({
  values,
  width = 64,
  height = 24,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const { colors } = useAppTheme();
  if (values.length < 2) return null;

  const pad = 3;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = Math.max(hi - lo, MIN_RANGE);
  const mid = (hi + lo) / 2;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad);
  const y = (v: number) => pad + (1 - (v - (mid - range / 2)) / range) * (height - 2 * pad);
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  const last = values.length - 1;

  return (
    <Svg width={width} height={height} accessible={false}>
      <Path
        d={d}
        fill="none"
        stroke={colors.chartLine}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={x(last)} cy={y(values[last])} r={2.5} fill={colors.chartLine} />
    </Svg>
  );
}
