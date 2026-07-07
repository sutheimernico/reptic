/**
 * Pure list reordering. Used by the plan editor to move a selected exercise up
 * or down; the resulting order is what gets persisted.
 */

/**
 * Move the item at `index` by `delta` positions. Returns a new array and never
 * mutates the input. Out-of-range indices and moves that would fall off either
 * end are clamped to a no-op (an equal-order copy), so callers can bind the
 * buttons unconditionally.
 */
export function moveBy<T>(list: readonly T[], index: number, delta: number): T[] {
  const next = [...list];
  if (index < 0 || index >= next.length) return next;
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
