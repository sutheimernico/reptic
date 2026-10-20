/**
 * The e1RM chart: history line, dashed forecast with its uncertainty band and
 * the plateau guide. One component, four skins: the geometry is shared, line
 * weight, caps, fills and grid follow the theme variant.
 */

import { useEffect, useId, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { formatKg, formatWeight } from '@/domain/format';
import type { ForecastPoint, StrengthPoint } from '@/domain/forecast';
import { useAppTheme } from '@/hooks/use-app-theme';
import { revealMs } from '@/theme/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const HEIGHT = 210;
const MIN_RANGE_KG = 4;
const PAD = { l: 8, r: 40, t: 18, b: 26 };
const DAY_MS = 86_400_000;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

export interface StrengthChartProps {
  /** History points inside the visible range (dayIndex relative to the full series). */
  points: StrengthPoint[];
  curve: ForecastPoint[];
  plateauKg: number | null;
  /** Date of the full series' dayIndex 0, to label the time axis. */
  originDate: string;
}

function niceStep(range: number): number {
  const raw = range / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function polylineLength(pts: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len;
}

const toPath = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

export function StrengthChart({ points, curve, plateauKg, originDate }: StrengthChartProps) {
  const [width, setWidth] = useState(0);
  const theme = useAppTheme();
  const { colors, variant, fonts } = theme;
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');

  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.value = reduced
      ? 1
      : withTiming(1, {
          duration: revealMs(theme, 3),
          easing: Easing.out(Easing.cubic),
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const forecastProgress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    forecastProgress.value = reduced
      ? 1
      : withDelay(
          revealMs(theme, 2) / 2,
          withTiming(1, { duration: revealMs(theme, 2) / 2 }),
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const geo = useMemo(() => {
    if (width <= 0 || points.length === 0) return null;
    const plotW = width - PAD.l - PAD.r;
    const plotH = HEIGHT - PAD.t - PAD.b;
    const firstDay = points[0].dayIndex;
    const lastPoint = points[points.length - 1];
    const lastDay = curve.length > 0 ? curve[curve.length - 1].dayIndex : lastPoint.dayIndex;
    const spanDays = Math.max(lastDay - firstDay, 1);
    const values = [
      ...points.map((p) => p.value),
      ...curve.flatMap((c) => [c.low, c.high]),
      ...(plateauKg !== null ? [plateauKg] : []),
    ];
    const step = niceStep(Math.max(Math.max(...values) - Math.min(...values), 4));
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    // A single session (or perfectly flat data) has no range; give it a window so nothing divides by 0.
    if (hi - lo < MIN_RANGE_KG) {
      const mid = (hi + lo) / 2;
      lo = mid - MIN_RANGE_KG / 2;
      hi = mid + MIN_RANGE_KG / 2;
    }
    const pad = (hi - lo) * 0.08;
    const yMin = lo - pad;
    const yMax = hi + pad;
    const x = (day: number) => PAD.l + ((day - firstDay) / spanDays) * plotW;
    const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * plotH;

    const history = points.map((p): [number, number] => [x(p.dayIndex), y(p.value)]);
    const last = history[history.length - 1];
    const forecast: [number, number][] =
      curve.length > 0
        ? [last, ...curve.map((c): [number, number] => [x(c.dayIndex), y(c.value)])]
        : [];
    const band =
      curve.length > 0
        ? `${toPath([
            [last[0], last[1]],
            ...curve.map((c): [number, number] => [x(c.dayIndex), y(c.high)]),
          ])} ${[...curve]
            .reverse()
            .map((c) => `L${x(c.dayIndex).toFixed(1)} ${y(c.low).toFixed(1)}`)
            .join(' ')} Z`
        : null;

    // Gridlines sit on round values inside the (tightly padded) value range.
    const ticks: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-6; v += step) ticks.push(v);

    // Month starts inside the span, thinned so labels never touch.
    const origin = new Date(originDate);
    const labels: { x: number; text: string }[] = [];
    const startDate = new Date(origin.getTime() + firstDay * DAY_MS);
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    while (cursor.getTime() <= startDate.getTime() + spanDays * DAY_MS) {
      const day = Math.round((cursor.getTime() - origin.getTime()) / DAY_MS);
      const month = cursor.getMonth();
      // A bare month name is ambiguous across years: tag January and every label on a long span.
      const withYear = month === 0 || spanDays > 365;
      const yy = String(cursor.getFullYear() % 100).padStart(2, '0');
      labels.push({ x: x(day), text: withYear ? `${MONTHS_SHORT[month]} ${yy}` : MONTHS_SHORT[month] });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const keepEvery = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 56))));
    const thinned = labels.filter((_, i) => (labels.length - 1 - i) % keepEvery === 0);

    return {
      plotW,
      history,
      last,
      forecast,
      band,
      ticks: ticks.map((v) => ({ v, y: y(v) })),
      labels: thinned,
      plateauY: plateauKg !== null ? y(plateauKg) : null,
      historyLen: polylineLength(history),
      forecastLen: polylineLength(forecast),
    };
  }, [width, points, curve, plateauKg, originDate]);

  const drawProps = useAnimatedProps(() => {
    const len = geo?.historyLen ?? 0;
    return { strokeDashoffset: len * (1 - progress.value) };
  });
  const fadeProps = useAnimatedProps(() => ({
    opacity: forecastProgress.value,
  }));

  const style = {
    evolved: {
      line: 2.5,
      cap: 'round' as const,
      dot: 4.5,
      fc: [7, 5],
      area: true,
      hatch: false,
    },
    warm: {
      line: 3.5,
      cap: 'round' as const,
      dot: 6,
      fc: [0.1, 8],
      area: true,
      hatch: false,
    },
    arcade: {
      line: 4,
      cap: 'square' as const,
      dot: 5.5,
      fc: [8, 5],
      area: false,
      hatch: false,
    },
    instrument: {
      line: 1.75,
      cap: 'butt' as const,
      dot: 3.5,
      fc: [5, 4],
      area: false,
      hatch: true,
    },
  }[variant];
  const isInstrument = variant === 'instrument';
  const isArcade = variant === 'arcade';
  const fcColor = colors.accent2;
  const axisText = {
    fill: colors.textSecondary,
    fontFamily: fonts.numeric,
    fontSize: 10,
  };

  return (
    <View
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ height: HEIGHT }}
      accessibilityRole="image"
      accessibilityLabel="Kraftverlauf mit Prognose"
    >
      {geo ? (
        <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
          <Defs>
            <LinearGradient id={`area${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.chartLine} stopOpacity={0.24} />
              <Stop offset="1" stopColor={colors.chartLine} stopOpacity={0} />
            </LinearGradient>
            <Pattern
              id={`hatch${uid}`}
              width={5}
              height={5}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <Line
                x1={0}
                y1={0}
                x2={0}
                y2={5}
                stroke={colors.accent2}
                strokeOpacity={0.5}
                strokeWidth={1.2}
              />
            </Pattern>
          </Defs>

          {geo.ticks.map((t) => (
            <G key={t.v}>
              <Line
                x1={PAD.l}
                x2={width - PAD.r}
                y1={t.y}
                y2={t.y}
                stroke={colors.grid}
                strokeWidth={isInstrument ? 1 : 0.75}
                strokeOpacity={isInstrument ? 1 : 0.7}
                strokeDasharray={isInstrument ? undefined : '2 5'}
              />
              <SvgText x={width - PAD.r + 10} y={t.y + 3.5} {...axisText}>
                {formatWeight(Math.round(t.v * 10) / 10)}
              </SvgText>
            </G>
          ))}
          {geo.labels.map((l) => (
            <SvgText
              key={`${l.text}${l.x}`}
              x={l.x}
              y={HEIGHT - 8}
              textAnchor="middle"
              {...axisText}
            >
              {l.text}
            </SvgText>
          ))}

          {geo.band ? (
            <AnimatedG animatedProps={fadeProps}>
              <Path
                d={geo.band}
                fill={style.hatch ? `url(#hatch${uid})` : colors.chartBand}
                stroke={isArcade ? colors.accent2 : undefined}
                strokeWidth={isArcade ? 1.5 : 0}
                strokeOpacity={0.5}
              />
              <Path
                d={toPath(geo.forecast)}
                fill="none"
                stroke={fcColor}
                strokeWidth={style.line}
                strokeLinecap={variant === 'warm' ? 'round' : 'butt'}
                strokeDasharray={style.fc.join(' ')}
              />
              {geo.plateauY !== null ? (
                <>
                  <Line
                    x1={geo.last[0]}
                    x2={width - PAD.r}
                    y1={geo.plateauY}
                    y2={geo.plateauY}
                    stroke={colors.accent2}
                    strokeWidth={1}
                    strokeOpacity={0.8}
                  />
                  <SvgText
                    x={width - PAD.r - 2}
                    y={geo.plateauY - 6}
                    textAnchor="end"
                    fill={colors.accent2}
                    fontFamily={fonts.bodyBold}
                    fontSize={11}
                  >
                    {`Plateau ~${formatKg(plateauKg ?? 0)}`}
                  </SvgText>
                </>
              ) : null}
            </AnimatedG>
          ) : null}

          {style.area && geo.history.length > 1 ? (
            <Path
              d={`${toPath(geo.history)} L${geo.last[0].toFixed(1)} ${HEIGHT - PAD.b} L${geo.history[0][0].toFixed(1)} ${HEIGHT - PAD.b} Z`}
              fill={`url(#area${uid})`}
            />
          ) : null}
          {geo.history.length > 1 ? (
            <AnimatedPath
              d={toPath(geo.history)}
              fill="none"
              stroke={colors.chartLine}
              strokeWidth={style.line}
              strokeLinecap={style.cap}
              strokeLinejoin={variant === 'arcade' ? 'miter' : 'round'}
              strokeDasharray={`${geo.historyLen} ${geo.historyLen}`}
              animatedProps={drawProps}
            />
          ) : null}
          {geo.history.map(([px, py], i) => {
            const isLast = i === geo.history.length - 1;
            if (isInstrument || isArcade) {
              const s = isLast ? style.dot * 2 : style.dot * 1.4;
              return (
                <Rect
                  key={i}
                  x={px - s / 2}
                  y={py - s / 2}
                  width={s}
                  height={s}
                  fill={isLast ? colors.chartLine : colors.card}
                  stroke={colors.chartLine}
                  strokeWidth={isArcade ? 2 : 1.5}
                />
              );
            }
            return isLast || geo.history.length <= 24 ? (
              <Circle
                key={i}
                cx={px}
                cy={py}
                r={isLast ? style.dot : style.dot * 0.55}
                fill={isLast ? colors.card : colors.chartLine}
                stroke={colors.chartLine}
                strokeWidth={isLast ? 3 : 0}
              />
            ) : null;
          })}
        </Svg>
      ) : null}
    </View>
  );
}
