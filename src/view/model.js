import { ago, downtime, duration, percent, span, stamp } from './format.js';

const BANNER = {
  operational: ['All systems operational', 'ok'],
  partial: ['Some systems are down', 'warn'],
  major: ['Major outage', 'bad'],
  pending: ['Running first checks', 'idle']
};

const STATE_LABEL = {
  up: 'Operational',
  down: 'Down',
  pending: 'Checking'
};

const STEPS = [
  { hide: 'hide-md', label: 'span-md', bars: 48 },
  { hide: 'hide-sm', label: 'span-sm', bars: 36 },
  { hide: 'hide-xs', label: 'span-xs', bars: 24 }
];

const clamp = (value) => Math.min(90, Math.max(12, value));

const bar = (hour, hidden) => {
  const names = ['bar', ...hidden];
  let detail;
  let down = null;

  if (hour.checks === 0) {
    names.push('none');
    detail = 'No data';
  } else if (hour.down === 0) {
    names.push('ok');
    detail = `no downtime · ${hour.avgMs}ms avg`;
  } else if (hour.up === 0) {
    names.push('bad');
    detail = `${downtime(hour.downMinutes)} · ${hour.checks} checks failed`;
  } else {
    names.push('part');
    down = clamp(Math.round((hour.down / hour.checks) * 100));
    detail = `${downtime(hour.downMinutes)} · ${hour.down} of ${hour.checks} checks failed`;
  }

  return {
    className: names.join(' '),
    hasDown: down !== null,
    down,
    timestamp: hour.at,
    detail,
    title: `${stamp(hour.at)} · ${detail}`
  };
};

const timeline = (service, historyHours) => {
  const total = service.hours.length;
  const kept = STEPS.map((step) => ({ ...step, bars: Math.min(step.bars, historyHours) }));

  const uptime = percent(service.uptime.window);

  return {
    ariaLabel: uptime
      ? `${service.label} uptime over the last ${span(historyHours)}: ${uptime}`
      : `${service.label} has no recorded history yet`,
    bars: service.hours.map((hour, i) =>
      bar(
        hour,
        kept.filter((step) => i < total - step.bars).map((step) => step.hide)
      )
    ),
    range: [{ className: 'span-lg', label: span(historyHours) }].concat(
      kept.map((step) => ({ className: step.label, label: span(step.bars) }))
    )
  };
};

const facts = (service, now, snapshot) => {
  const out = [];
  const add = (fact) =>
    out.push({
      aside: false,
      hasValue: false,
      hasError: false,
      value: null,
      error: null,
      text: '',
      ...fact
    });

  if (service.latencyMs !== null) add({ text: `${service.latencyMs}ms` });
  else if (service.lastError) add({ hasError: true, error: service.lastError });

  const window = percent(service.uptime.window);
  const month = percent(service.uptime.month);

  if (window) add({ hasValue: true, value: window, text: `over ${span(snapshot.historyHours)}` });
  if (month)
    add({ hasValue: true, value: month, text: `over ${snapshot.monthDays} days`, aside: true });
  if (service.lastCheck) add({ text: `checked ${ago(service.lastCheck, now)}`, aside: true });

  return out;
};

const incident = (entry) => {
  const ongoing = entry.endedAt === null;
  const length = duration(entry.ms);

  return {
    outcome: ongoing ? 'live' : 'past',
    label: entry.label,
    duration: ongoing ? `ongoing, ${length}` : length,
    timestamp: entry.startedAt,
    isoTime: new Date(entry.startedAt).toISOString(),
    utcTime: stamp(entry.startedAt),
    reason: entry.reason
  };
};

export const pageModel = (snapshot, now) => {
  const [headline, tone] = BANNER[snapshot.overall];
  const down = snapshot.services.filter((s) => s.state === 'down').length;
  const total = snapshot.services.length;

  return {
    tone,
    headline,
    sub:
      snapshot.overall === 'operational'
        ? `All ${total} services responding`
        : snapshot.overall === 'pending'
          ? 'Results appear within a minute of startup'
          : `${down} of ${total} services not responding`,

    services: snapshot.services.map((service) => ({
      state: service.state,
      label: service.label,
      blurb: service.blurb ?? '',
      stateLabel: STATE_LABEL[service.state],
      ...timeline(service, snapshot.historyHours),
      facts: facts(service, now, snapshot)
    })),

    hasIncidents: snapshot.incidents.length > 0,
    incidents: snapshot.incidents.map(incident),
    incidentSpan: span(snapshot.incidentWindowHours),

    seconds: Math.round(snapshot.intervalMs / 1000),
    lastRun: ago(snapshot.generatedAt, now),
    retainDays: snapshot.retainDays
  };
};
