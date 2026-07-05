/**
 * Pure logic for turning a multi-select of plans into a single session's
 * exercise list.
 */

export interface PlanExercises {
  planId: number;
  /** Exercise ids in the plan's own order. */
  exerciseIds: number[];
}

/**
 * Merge the selected plans (in the order they were selected) into one ordered,
 * de-duplicated exercise id list. First occurrence wins, so an exercise shared
 * by two plans appears once, at its earliest position.
 */
export function mergePlanExercises(plans: PlanExercises[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const plan of plans) {
    for (const id of plan.exerciseIds) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
  }
  return result;
}
