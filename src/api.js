const iso = (ms) => (ms === null || ms === undefined ? null : new Date(ms).toISOString());

export const toJson = (snapshot) => {
  return {
    generatedAt: iso(snapshot.generatedAt),
    intervalMs: snapshot.intervalMs,
    historyHours: snapshot.historyHours,
    incidentWindowHours: snapshot.incidentWindowHours,
    retainDays: snapshot.retainDays,
    monthDays: snapshot.monthDays,
    overall: snapshot.overall,
    services: snapshot.services.map((service) => ({
      id: service.id,
      label: service.label,
      blurb: service.blurb,
      url: service.url,
      state: service.state,
      lastCheck: iso(service.lastCheck),
      lastError: service.lastError,
      latencyMs: service.latencyMs,
      uptimePct: {
        window: service.uptime.window,
        month: service.uptime.month
      },
      hours: service.hours.map((hour) => ({
        at: iso(hour.at),
        checks: hour.checks,
        up: hour.up,
        down: hour.down,
        avgMs: hour.avgMs,
        downMinutes: Math.round(hour.downMinutes * 10) / 10
      }))
    })),
    incidents: snapshot.incidents.map((entry) => ({
      service: entry.id,
      label: entry.label,
      startedAt: iso(entry.startedAt),
      endedAt: iso(entry.endedAt),
      durationMs: entry.ms,
      failedChecks: entry.checks,
      reason: entry.reason
    }))
  };
};
