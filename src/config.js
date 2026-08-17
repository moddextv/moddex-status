const optional = (key, fallback) => process.env[key] || fallback;

const int = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  return n;
};

const historyHours = int('HISTORY_HOURS', 72);

export const config = {
  port: int('PORT', 4002),

  checkIntervalMs: int('CHECK_INTERVAL_MS', 60_000),
  checkTimeoutMs: int('CHECK_TIMEOUT_MS', 5_000),

  historyHours,

  dbPath: optional('DB_PATH', './data/status.db'),

  retainDays: int('RETAIN_DAYS', 90),

  rawRetainHours: int('RAW_RETAIN_HOURS', 168),

  incidentLimit: int('INCIDENT_LIMIT', 6),
  incidentWindowHours: int('INCIDENT_WINDOW_HOURS', historyHours),

  monitors: [
    {
      id: 'moddex-web',
      label: 'moddex.tv',
      blurb: 'Web app',
      url: optional('MONITOR_WEB_URL', 'https://moddex.tv/health'),
      service: 'moddex-web'
    },
    {
      id: 'moddex-api',
      label: 'api.moddex.tv',
      blurb: 'Core API and database',
      url: optional('MONITOR_API_URL', 'https://api.moddex.tv/health'),
      service: 'moddex-api'
    },
    {
      id: 'moddex-ws',
      label: 'ws.moddex.tv',
      blurb: 'Realtime fan-out',
      url: optional('MONITOR_WS_URL', 'https://ws.moddex.tv/health'),
      service: 'moddex-ws'
    },
    {
      id: 'moddex-eventsub',
      label: 'eventsub',
      blurb: 'Live role events',
      url: optional('MONITOR_EVENTSUB_URL', 'https://api.moddex.tv/v1/eventsub/health'),
      service: 'moddex-api'
    },
    {
      id: 'moddex-discord',
      label: 'discord bot',
      blurb: 'Welcomes, boosts and badge roles',
      url: optional('MONITOR_DISCORD_URL', 'https://discord.moddex.tv/health'),
      service: 'moddex-discord'
    }
  ]
};
