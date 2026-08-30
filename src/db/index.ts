/**
 * Typed data layer over expo-sqlite. Screens call these functions; nothing else
 * touches SQL. This module is the public surface — it only re-exports, so
 * callers keep importing from `@/db` regardless of how the layer is split.
 */

export { DATABASE_VERSION, migrateDbIfNeeded } from '@/db/schema';

export * from '@/db/backup';
export * from '@/db/exercises';
export * from '@/db/gyms';
export * from '@/db/plans';
export * from '@/db/sets';
export * from '@/db/settings';
export * from '@/db/workouts';
