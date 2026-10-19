/**
 * Bundled font families per theme. Custom families ship one file per weight, so the
 * weight lives in the family name — components must not also set `fontWeight`.
 */

import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

export interface FontSet {
  display: string;
  body: string;
  bodyBold: string;
  numeric: string;
  label: string;
}

/** Object handed to `useFonts`: family name -> font file. */
export const FONT_MAP = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_800ExtraBold,
  Fraunces_600SemiBold,
  DMSans_400Regular,
  DMSans_700Bold,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_800ExtraBold,
  IBMPlexSans_400Regular,
  IBMPlexSans_600SemiBold,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
};

export const FONTS = {
  evolved: {
    display: 'PlusJakartaSans_800ExtraBold',
    body: 'PlusJakartaSans_400Regular',
    bodyBold: 'PlusJakartaSans_600SemiBold',
    numeric: 'PlusJakartaSans_800ExtraBold',
    label: 'PlusJakartaSans_600SemiBold',
  },
  warm: {
    display: 'Fraunces_600SemiBold',
    body: 'DMSans_400Regular',
    bodyBold: 'DMSans_700Bold',
    numeric: 'Fraunces_600SemiBold',
    label: 'DMSans_700Bold',
  },
  arcade: {
    display: 'BricolageGrotesque_800ExtraBold',
    body: 'BricolageGrotesque_500Medium',
    bodyBold: 'BricolageGrotesque_800ExtraBold',
    numeric: 'BricolageGrotesque_800ExtraBold',
    label: 'BricolageGrotesque_800ExtraBold',
  },
  instrument: {
    display: 'IBMPlexSans_600SemiBold',
    body: 'IBMPlexSans_400Regular',
    bodyBold: 'IBMPlexSans_600SemiBold',
    numeric: 'JetBrainsMono_700Bold',
    label: 'JetBrainsMono_500Medium',
  },
} satisfies Record<'evolved' | 'warm' | 'arcade' | 'instrument', FontSet>;
