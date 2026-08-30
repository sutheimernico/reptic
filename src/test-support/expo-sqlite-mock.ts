/**
 * Stand-in for `expo-sqlite` in component tests: `useSQLiteContext` hands out
 * the harness database (see `./db`). Everything else the app imports from the
 * package is types only, which never reach runtime.
 */
import { getTestDb } from '@/test-support/db';

export const useSQLiteContext = getTestDb;
export const SQLiteProvider = ({ children }: { children: unknown }) => children;
