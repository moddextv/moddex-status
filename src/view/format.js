export const ago = (ms, now) => {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;

  return `${Math.round(seconds / 86400)} d ago`;
};

export const duration = (ms) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 90) return `${seconds}s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;

  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
};

export const downtime = (minutes) => {
  if (minutes <= 0) return null;
  if (minutes < 1) return `≈${Math.round(minutes * 60)}s down`;
  if (minutes >= 59.5) return 'down all hour';

  return `≈${Math.round(minutes)} min down`;
};

export const percent = (value) => {
  if (value === null) return null;
  if (value >= 100) return '100%';

  return `${(Math.floor(value * 100) / 100).toFixed(2)}%`;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

export const stamp = (ms) => {
  const d = new Date(ms);

  return `${DAYS[d.getUTCDay()]} ${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
};

export const span = (hours) => {
  if (hours % 24 === 0 && hours >= 24) {
    const days = hours / 24;
    return days === 1 ? '24 hours' : `${days} days`;
  }

  return `${hours} hours`;
};
