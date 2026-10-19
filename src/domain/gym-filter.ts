/** Gym multi-select for the strength chart: persisted per exercise, "all" is the empty selection. */

export type GymFilter = number[] | 'all';

export function gymFilterKey(exerciseId: number): string {
  return `progress_gyms_${exerciseId}`;
}

/** Drops gyms without history any more; anything unusable falls back to "all". */
export function parseGymFilter(stored: string | null, availableGymIds: number[]): GymFilter {
  if (!stored) return 'all';
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return 'all';
  }
  if (!Array.isArray(parsed)) return 'all';
  const kept = parsed.filter(
    (id): id is number => typeof id === 'number' && availableGymIds.includes(id),
  );
  return kept.length > 0 ? kept : 'all';
}

export function toggleGym(current: GymFilter, gymId: number | 'all'): GymFilter {
  if (gymId === 'all' || current === 'all') return gymId === 'all' ? 'all' : [gymId];
  const next = current.includes(gymId) ? current.filter((id) => id !== gymId) : [...current, gymId];
  return next.length > 0 ? next : 'all';
}

export function applyGymFilter<T extends { gymId: number | null }>(
  points: T[],
  filter: GymFilter,
): T[] {
  return filter === 'all'
    ? points
    : points.filter((p) => p.gymId !== null && filter.includes(p.gymId));
}
