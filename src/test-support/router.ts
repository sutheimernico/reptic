/**
 * Route state for component tests. The `expo-router` mock in `jest.setup.tsx`
 * reads from here, because a `jest.mock` factory is hoisted above anything a
 * test file could hand it directly.
 */

let params: Record<string, string> = {};

export function setRouteParams(next: Record<string, string>): void {
  params = next;
}

export function getRouteParams(): Record<string, string> {
  return params;
}

export const routerMock = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
};

/** Clear navigation spies and params between tests. */
export function resetRouter(): void {
  params = {};
  routerMock.push.mockClear();
  routerMock.back.mockClear();
  routerMock.replace.mockClear();
}
