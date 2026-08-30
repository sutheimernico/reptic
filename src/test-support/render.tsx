/**
 * Renders a screen or component inside the providers the app wraps it in, so a
 * test exercises the same tree the device does.
 *
 * Note for anyone extending these tests: in @testing-library/react-native v14
 * `render`, `fireEvent` and `act` are all async — every call needs an `await`,
 * or the assertion runs against a tree that has not settled yet.
 */
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { RestTimerProvider } from '@/components/rest-timer';
import { ThemeProvider } from '@/theme/theme-provider';

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <RestTimerProvider>{children}</RestTimerProvider>
    </ThemeProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react-native';
