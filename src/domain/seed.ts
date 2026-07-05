/**
 * Seed data shipped on first launch: a standard exercise library and three
 * editable example plans. Pure data — the db layer turns this into rows.
 * Everything here is editable/deletable by the user afterwards.
 */

import type { MuscleGroup } from '@/domain/types';

export interface SeedExercise {
  name: string;
  muscleGroup: MuscleGroup;
}

export interface SeedPlan {
  name: string;
  color: string;
  /** Exercise names; must all exist in EXERCISE_LIBRARY (asserted by tests). */
  exerciseNames: string[];
}

export const EXERCISE_LIBRARY: SeedExercise[] = [
  // Brust
  { name: 'Bankdrücken', muscleGroup: 'Brust' },
  { name: 'Schrägbankdrücken', muscleGroup: 'Brust' },
  { name: 'Kurzhantel-Bankdrücken', muscleGroup: 'Brust' },
  { name: 'Butterfly', muscleGroup: 'Brust' },
  { name: 'Dips', muscleGroup: 'Brust' },
  // Rücken
  { name: 'Latzug', muscleGroup: 'Rücken' },
  { name: 'Klimmzüge', muscleGroup: 'Rücken' },
  { name: 'Langhantelrudern', muscleGroup: 'Rücken' },
  { name: 'Kabelrudern', muscleGroup: 'Rücken' },
  { name: 'Kreuzheben', muscleGroup: 'Rücken' },
  // Schultern
  { name: 'Schulterdrücken', muscleGroup: 'Schultern' },
  { name: 'Seitheben', muscleGroup: 'Schultern' },
  { name: 'Vorgebeugtes Seitheben', muscleGroup: 'Schultern' },
  { name: 'Frontheben', muscleGroup: 'Schultern' },
  // Trapez/Nacken
  { name: 'Shrugs', muscleGroup: 'Trapez/Nacken' },
  { name: 'Aufrechtes Rudern', muscleGroup: 'Trapez/Nacken' },
  { name: 'Face Pulls', muscleGroup: 'Trapez/Nacken' },
  // Beine
  { name: 'Kniebeugen', muscleGroup: 'Beine' },
  { name: 'Beinpresse', muscleGroup: 'Beine' },
  { name: 'Beinstrecker', muscleGroup: 'Beine' },
  { name: 'Beinbeuger', muscleGroup: 'Beine' },
  { name: 'Wadenheben', muscleGroup: 'Beine' },
  { name: 'Rumänisches Kreuzheben', muscleGroup: 'Beine' },
  // Bizeps
  { name: 'Langhantel-Curls', muscleGroup: 'Bizeps' },
  { name: 'Kurzhantel-Curls', muscleGroup: 'Bizeps' },
  { name: 'Hammer-Curls', muscleGroup: 'Bizeps' },
  // Trizeps
  { name: 'Trizepsdrücken (Kabel)', muscleGroup: 'Trizeps' },
  { name: 'Enges Bankdrücken', muscleGroup: 'Trizeps' },
  { name: 'French Press', muscleGroup: 'Trizeps' },
  // Core
  { name: 'Crunches', muscleGroup: 'Core' },
  { name: 'Beinheben', muscleGroup: 'Core' },
  { name: 'Plank', muscleGroup: 'Core' },
];

export const EXAMPLE_PLANS: SeedPlan[] = [
  {
    name: 'Push',
    color: '#6366F1',
    exerciseNames: [
      'Bankdrücken',
      'Schrägbankdrücken',
      'Schulterdrücken',
      'Seitheben',
      'Trizepsdrücken (Kabel)',
    ],
  },
  {
    name: 'Pull',
    color: '#8B5CF6',
    exerciseNames: ['Latzug', 'Langhantelrudern', 'Kabelrudern', 'Shrugs', 'Langhantel-Curls'],
  },
  {
    name: 'Beine',
    color: '#14B8A6',
    exerciseNames: ['Kniebeugen', 'Beinpresse', 'Beinbeuger', 'Beinstrecker', 'Wadenheben'],
  },
];
