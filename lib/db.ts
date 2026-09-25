import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

type SQLValue = string | number | bigint | null | Uint8Array;

const globalForDb = globalThis as unknown as { __tlDb?: DatabaseSync };

function open(): DatabaseSync {
  const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || 'data/talentledger.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(fs.readFileSync(path.join(process.cwd(), 'lib/schema.sql'), 'utf8'));
  return db;
}

export function db(): DatabaseSync {
  if (!globalForDb.__tlDb) globalForDb.__tlDb = open();
  return globalForDb.__tlDb;
}

/** Run a SELECT and return all rows. */
export function all<T = Record<string, unknown>>(sql: string, ...params: SQLValue[]): T[] {
  // node:sqlite returns null-prototype objects; spread into plain objects so rows can cross to Client Components.
  return db().prepare(sql).all(...params).map((r) => ({ ...r })) as T[];
}

/** Run a SELECT and return the first row (or undefined). */
export function get<T = Record<string, unknown>>(sql: string, ...params: SQLValue[]): T | undefined {
  const r = db().prepare(sql).get(...params);
  return (r ? { ...r } : undefined) as T | undefined;
}

/** Run an INSERT/UPDATE/DELETE. Returns the new row id for inserts. */
export function run(sql: string, ...params: SQLValue[]): { changes: number; id: number } {
  const r = db().prepare(sql).run(...params);
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec('BEGIN');
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}
