/**
 * Minimal stand-in for react-native-reanimated under Jest: its worklet runtime
 * does not exist there. Shared values are plain boxes, animation helpers return
 * their target immediately, so components render in their end state and tests
 * assert behaviour, not frames.
 */
import { createElement, forwardRef } from 'react';
import { Text, View } from 'react-native';

const box = <T,>(initial: T) => {
  const ref = {
    value: initial,
    get: () => ref.value,
    set: (next: T) => {
      ref.value = next;
    },
  };
  return ref;
};
const passthrough = <T,>(value: T) => value;

const AnimatedView = forwardRef<unknown, Record<string, unknown>>((props, ref) =>
  createElement(View, { ...props, ref } as never),
);
AnimatedView.displayName = 'Animated.View';
const AnimatedText = forwardRef<unknown, Record<string, unknown>>((props, ref) =>
  createElement(Text, { ...props, ref } as never),
);
AnimatedText.displayName = 'Animated.Text';

const Easing = {
  linear: (t: number) => t,
  out: (fn: (t: number) => number) => fn,
  cubic: (t: number) => t,
  bezier: () => (t: number) => t,
};

let reducedMotion = false;

module.exports = {
  /** Test hook: flips what `useReducedMotion()` returns. */
  __setReducedMotion: (value: boolean) => {
    reducedMotion = value;
  },
  __esModule: true,
  default: {
    View: AnimatedView,
    Text: AnimatedText,
    createAnimatedComponent: <T,>(component: T) => component,
  },
  Easing,
  useSharedValue: (initial: unknown) => box(initial),
  useAnimatedStyle: (factory: () => object) => factory(),
  useReducedMotion: () => reducedMotion,
  withTiming: passthrough,
  withSpring: passthrough,
  withDelay: (_ms: number, value: unknown) => value,
  withSequence: (...values: unknown[]) => values[values.length - 1],
  interpolate: (value: number, input: number[], output: number[]) =>
    value <= input[0] ? output[0] : output[output.length - 1],
  cancelAnimation: () => {},
};
