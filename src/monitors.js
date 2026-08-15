import { config } from './config.js';
import {
  HOUR_MS,
  checksSince,
  hourOf,
  hoursSince,
  lastCheck,
  prune,
  record,
  totalsSince
} from './store.js';

/** @type {Map<string, {id:string,label:string,blurb:string,url:string}>} */
const state = new Map(config.monitors.map((m) => [m.id, { ...m }]));

const CODE_TEXT = {
  ECONNREFUSED: 'connection refused',
  ECONNRESET: 'connection reset',
  EHOSTUNREACH: 'host unreachable',
  ENETUNREACH: 'network unreachable',
  ENOTFOUND: 'DNS: no such host',
  EAI_AGAIN: 'DNS lookup failed',
  ETIMEDOUT: 'TCP timeout',
  CERT_HAS_EXPIRED: 'TLS: certificate expired',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'TLS: self-signed certificate',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS: cannot verify certificate',
  ERR_TLS_CERT_ALTNAME_INVALID: 'TLS: hostname mismatch'
};

// node's fetch reports every failure as `TypeError: fetch failed` and hides the
// reason in .cause, wrapped in an AggregateError for connection errors
const describe = (err) => {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return `timeout after ${config.checkTimeoutMs}ms`;
  }
  let node = err;
  let deepest = err?.message;
  for (let depth = 0; node && depth < 5; depth++) {
    const code =
      node.code ??
      (Array.isArray(node.errors) ? node.errors.find((e) => e?.code)?.code : undefined);
    if (code) return CODE_TEXT[code] ?? code;
    if (node.message) deepest = node.message;
    node = node.cause;
  }
  return deepest ?? 'unreachable';
};

const serviceOf = async (res) => {
  try {
    // content-type first: this catches a container running the wrong image, and
    // the wrong image need not answer with a small json document
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null;

    const name = (await res.json())?.service;

    return typeof name === 'string' && name ? name : null;
  } catch {
    return null;
  }
};

export const probe = async (url, expected) => {
  const started = process.hrtime.bigint();
  const ms = () => Number(process.hrtime.bigint() - started) / 1e6;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(config.checkTimeoutMs),
      headers: { 'user-agent': 'moddex-status' },
      redirect: 'manual'
    });

    // time-to-headers, captured before any body is read, so the stored history
    // stays comparable
    const latency = ms();

    if (!res.ok) return { ok: false, status: res.status, ms: latency, error: null };
    if (!expected) return { ok: true, status: res.status, ms: latency, error: null };

    const served = await serviceOf(res);

    if (served === expected) return { ok: true, status: res.status, ms: latency, error: null };

    return {
      ok: false,
      status: res.status,
      ms: latency,
      error: served ? `serving ${served}` : 'no service in body'
    };
  } catch (err) {
    return { ok: false, status: null, ms: ms(), error: describe(err) };
  }
};

const checkAll = async () => {
  const at = Date.now();
  await Promise.all(
    [...state.values()].map(async (m) => record(m.id, at, await probe(m.url, m.service)))
  );
  cached = null;
};

const pct = (up, total) => (total ? (up / total) * 100 : null);

const reasonFor = (row) => row.error ?? (row.status ? `HTTP ${row.status}` : 'no response');

const timelineFor = (monitorId, now) => {
  const newest = hourOf(now);
  const oldest = newest - (config.historyHours - 1) * HOUR_MS;

  const byHour = new Map(hoursSince(monitorId, oldest).map((row) => [row.hour_ms, row]));

  return Array.from({ length: config.historyHours }, (_, i) => {
    const at = oldest + i * HOUR_MS;
    const row = byHour.get(at);
    if (!row) return { at, checks: 0, up: 0, down: 0, avgMs: null, downMinutes: 0 };

    const down = row.checks - row.up;
    const elapsed = at === newest ? Math.max(1, (now - at) / 60_000) : 60;

    return {
      at,
      checks: row.checks,
      up: row.up,
      down,
      avgMs: row.timed ? Math.round(row.sum_ms / row.timed) : null,
      downMinutes: (down / row.checks) * elapsed
    };
  });
};

const incidentsFor = (monitor, fromMs, now) => {
  const out = [];
  let run = null;

  const close = (ongoing) => {
    out.push({
      id: monitor.id,
      label: monitor.label,
      startedAt: run.from,
      endedAt: ongoing ? null : run.to + config.checkIntervalMs,
      ms: (ongoing ? now : run.to + config.checkIntervalMs) - run.from,
      checks: run.checks,
      reason: run.reason
    });
  };

  for (const row of checksSince(monitor.id, fromMs)) {
    if (row.ok) {
      if (run) close(false);
      run = null;
      continue;
    }
    run ??= { from: row.at_ms, to: row.at_ms, checks: 0, reason: reasonFor(row) };
    run.to = row.at_ms;
    run.checks += 1;
  }
  if (run) close(true);

  return out;
};

let cached = null;

export const snapshot = () => {
  if (cached) return cached;

  const now = Date.now();
  const windowFrom = hourOf(now) - (config.historyHours - 1) * HOUR_MS;
  const monthDays = Math.min(30, config.retainDays);
  const monthFrom = hourOf(now) - monthDays * 24 * HOUR_MS;
  const incidentFrom = now - config.incidentWindowHours * HOUR_MS;

  const services = [...state.values()].map((m) => {
    const last = lastCheck(m.id);
    const window = totalsSince(m.id, windowFrom);
    const month = totalsSince(m.id, monthFrom);

    return {
      id: m.id,
      label: m.label,
      blurb: m.blurb,
      url: m.url,
      state: last === null ? 'pending' : last.ok ? 'up' : 'down',
      lastCheck: last ? last.at_ms : null,
      lastError: last && !last.ok ? reasonFor(last) : null,
      latencyMs: last?.ok ? Math.round(last.ms) : null,
      uptime: { window: pct(window.up, window.checks), month: pct(month.up, month.checks) },
      hours: timelineFor(m.id, now)
    };
  });

  const incidents = [...state.values()]
    .flatMap((m) => incidentsFor(m, incidentFrom, now))
    .sort((a, b) => (b.endedAt === null) - (a.endedAt === null) || b.startedAt - a.startedAt)
    .slice(0, config.incidentLimit);

  const rated = services.filter((s) => s.state !== 'pending');

  cached = {
    generatedAt: now,
    intervalMs: config.checkIntervalMs,
    historyHours: config.historyHours,
    incidentWindowHours: config.incidentWindowHours,
    retainDays: config.retainDays,
    monthDays,
    overall:
      rated.length === 0
        ? 'pending'
        : rated.every((s) => s.state === 'up')
          ? 'operational'
          : rated.every((s) => s.state === 'down')
            ? 'major'
            : 'partial',
    services,
    incidents
  };

  return cached;
};

export const startPolling = () => {
  const poll = setInterval(() => {
    void checkAll();
  }, config.checkIntervalMs);
  const tidy = setInterval(() => prune(Date.now()), HOUR_MS);

  poll.unref();
  tidy.unref();

  prune(Date.now());
  void checkAll();

  return () => {
    clearInterval(poll);
    clearInterval(tidy);
  };
};
