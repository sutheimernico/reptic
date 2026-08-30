/**
 * A `SQLiteDatabase`-shaped adapter over `node:sqlite`, so the real SQL in
 * `@/db` can be exercised in plain Jest without a device.
 *
 * Kept out of `__tests__/` on purpose: everything in that directory is picked
 * up as a suite and would fail with "must contain at least one test". This is
 * the shared harness for `schema.test.ts` and `queries.test.ts`.
 *
 * The mapping mirrors expo-sqlite@57's native layer:
 *  - `execAsync` is sqlite3_exec: statement by statement, autocommit, stops at
 *    the first error with earlier statements already committed.
 *  - `getFirstAsync` / `getAllAsync` / `runAsync` are prepared statements
 *    (sqlite3_prepare_v2) with positional parameters.
 *  - `withTransactionAsync` is BEGIN → task → COMMIT, ROLLBACK + rethrow on
 *    failure (verified against SQLiteDatabase.js:120-128).
 *
 * Difference to be aware of: node:sqlite is synchronous, so these promises
 * resolve immediately. Tests can therefore not observe interleaving that the
 * native async layer would allow — race conditions must be reasoned about, not
 * tested here.
 */
import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

/** Counts the statements the data layer prepares, so N+1 patterns can be pinned. */
export interface QueryCounter {
  count: number;
  /** The SQL of every prepared statement, in order (for debugging a failure). */
  statements: string[];
}

export function adapt(db: DatabaseSync, counter?: QueryCounter): SQLiteDatabase {
  const prepare = (sql: string) => {
    if (counter) {
      counter.count += 1;
      counter.statements.push(sql);
    }
    return db.prepare(sql);
  };
  return {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    getFirstAsync: async (sql: string, ...params: unknown[]) =>
      prepare(sql).get(...(params as never[])) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) =>
      prepare(sql).all(...(params as never[])),
    runAsync: async (sql: string, ...params: unknown[]) => {
      const res = prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(res.lastInsertRowid), changes: Number(res.changes) };
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
}

/** A fresh in-memory database plus its adapter and a statement counter. */
export function openDb(): { raw: DatabaseSync; db: SQLiteDatabase; queries: QueryCounter } {
  const raw = new DatabaseSync(':memory:');
  const queries: QueryCounter = { count: 0, statements: [] };
  return { raw, db: adapt(raw, queries), queries };
}
