import { log } from './log.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { config } from './config.js';

export const HOUR_MS = 3_600_000;

export const hourOf = (ms) => Math.floor(ms / HOUR_MS) * HOUR_MS;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS checks (
	monitor_id TEXT    NOT NULL,
	at_ms      INTEGER NOT NULL,
	ok         INTEGER NOT NULL,
	status     INTEGER,
	ms         REAL    NOT NULL,
	error      TEXT
);

-- Unique, not merely indexed: one monitor cannot be probed twice in the same
-- millisecond, and saying so keeps a double-write from ever becoming two rows
-- that both count. The recorder leans on that — it catches and logs rather than
-- letting a collision reach the polling loop.
--
-- It was added for an importer that backfilled this file from the old in-memory
-- store and could be re-run; that script is gone, and the constraint is worth
-- keeping without it.
--
-- No backticks in this block: it is a template literal, and one would end it.
--
-- Under a new name, and the old one dropped first, because IF NOT EXISTS
-- matches on the name alone — reusing it would find the earlier non-unique
-- index and skip quietly, leaving duplicates possible.
DROP INDEX IF EXISTS checks_monitor_at;
CREATE UNIQUE INDEX IF NOT EXISTS checks_monitor_at_unique ON checks (monitor_id, at_ms);

CREATE TABLE IF NOT EXISTS hours (
	monitor_id TEXT    NOT NULL,
	hour_ms    INTEGER NOT NULL,
	checks     INTEGER NOT NULL,
	up         INTEGER NOT NULL,
	sum_ms     REAL    NOT NULL,
	timed      INTEGER NOT NULL,
	PRIMARY KEY (monitor_id, hour_ms)
) WITHOUT ROWID;
`;

const connect = (path) => {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(SCHEMA);
  return db;
};

let db;
try {
  db = connect(config.dbPath);
  log.info(`history at ${config.dbPath}`);
} catch (err) {
  log.warn(`cannot open ${config.dbPath} (${err.message}) — history is memory-only`);
  db = connect(':memory:');
}

const stmt = {
  insertCheck: db.prepare(
    'INSERT INTO checks (monitor_id, at_ms, ok, status, ms, error) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  bumpHour: db.prepare(`
		INSERT INTO hours (monitor_id, hour_ms, checks, up, sum_ms, timed)
		VALUES (?, ?, 1, ?, ?, ?)
		ON CONFLICT (monitor_id, hour_ms) DO UPDATE SET
			checks = hours.checks + 1,
			up     = hours.up     + excluded.up,
			sum_ms = hours.sum_ms + excluded.sum_ms,
			timed  = hours.timed  + excluded.timed
	`),
  hoursSince: db.prepare(
    'SELECT hour_ms, checks, up, sum_ms, timed FROM hours WHERE monitor_id = ? AND hour_ms >= ? ORDER BY hour_ms'
  ),
  totalsSince: db.prepare(
    'SELECT COALESCE(SUM(checks), 0) AS checks, COALESCE(SUM(up), 0) AS up FROM hours WHERE monitor_id = ? AND hour_ms >= ?'
  ),
  checksSince: db.prepare(
    'SELECT at_ms, ok, ms, status, error FROM checks WHERE monitor_id = ? AND at_ms >= ? ORDER BY at_ms'
  ),
  lastCheck: db.prepare(
    'SELECT at_ms, ok, ms, status, error FROM checks WHERE monitor_id = ? ORDER BY at_ms DESC LIMIT 1'
  ),
  dropChecks: db.prepare('DELETE FROM checks WHERE at_ms < ?'),
  dropHours: db.prepare('DELETE FROM hours WHERE hour_ms < ?')
};

const bit = (value) => (value ? 1 : 0);

export const record = (monitorId, at, result) => {
  try {
    stmt.insertCheck.run(monitorId, at, bit(result.ok), result.status, result.ms, result.error);
    stmt.bumpHour.run(
      monitorId,
      hourOf(at),
      bit(result.ok),
      result.ok ? result.ms : 0,
      bit(result.ok)
    );
  } catch (err) {
    log.error(`could not record ${monitorId}`, err);
  }
};

export const hoursSince = (monitorId, fromMs) => stmt.hoursSince.all(monitorId, fromMs);

export const totalsSince = (monitorId, fromMs) => stmt.totalsSince.get(monitorId, fromMs);

export const checksSince = (monitorId, fromMs) => stmt.checksSince.all(monitorId, fromMs);

export const lastCheck = (monitorId) => stmt.lastCheck.get(monitorId) ?? null;

export const prune = (now) => {
  try {
    stmt.dropChecks.run(now - config.rawRetainHours * HOUR_MS);
    stmt.dropHours.run(now - config.retainDays * 24 * HOUR_MS);
  } catch (err) {
    log.error('prune failed', err);
  }
};

export const close = () => {
  try {
    db.close();
  } catch {}
};
