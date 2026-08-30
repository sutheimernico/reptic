/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#64748B',
    background: '#F4F5F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E0E7FF',
    card: '#FFFFFF',
    border: '#E2E8F0',
    placeholder: '#CBD5E1',
    accent: '#4F46E5',
    accentEnd: '#7C3AED',
    onAccent: '#FFFFFF',
    success: '#16A34A',
    danger: '#DC2626',
  },
  dark: {
    text: '#F3F5F9',
    textSecondary: '#7C8398',
    background: '#0B0D14',
    backgroundElement: '#151925',
    backgroundSelected: '#18203A',
    card: '#151925',
    border: '#232838',
    placeholder: '#454B5E',
    accent: '#6366F1',
    accentEnd: '#8B5CF6',
    onAccent: '#FFFFFF',
    success: '#3DDC84',
    danger: '#F87171',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Radii used across cards, inputs, and buttons. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
