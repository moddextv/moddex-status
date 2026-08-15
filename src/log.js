const at = () => new Date().toISOString();

export const log = {
  info: (message) => console.log(`${at()} [INFO]: ${message}`),
  warn: (message) => console.warn(`${at()} [WARN]: ${message}`),
  error: (message, error) =>
    console.error(`${at()} [ERROR]: ${message}${error ? ` — ${error.stack ?? error}` : ''}`)
};
