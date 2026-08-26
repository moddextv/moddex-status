import { createServer } from 'node:http';
import { ASSETS, ASSET_MAX_AGE } from './assets.js';
import { toJson } from './api.js';
import { config } from './config.js';
import { log } from './log.js';
import { snapshot, startPolling } from './monitors.js';
import { close as closeStore } from './store.js';
import { renderPage } from './view/page.js';

const send = (res, code, type, body) => {
  res.writeHead(code, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
};

const json = (res, code, obj) =>
  send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj, null, 2));

const sendAsset = (req, res, asset) => {
  if (req.headers['if-none-match'] === asset.etag) {
    res.writeHead(304, { etag: asset.etag, 'cache-control': `public, max-age=${ASSET_MAX_AGE}` });
    return res.end();
  }

  res.writeHead(200, {
    'content-type': asset.type,
    'content-length': asset.body.length,
    'cache-control': `public, max-age=${ASSET_MAX_AGE}`,
    etag: asset.etag,
    'x-content-type-options': 'nosniff'
  });

  return res.end(asset.body);
};

const route = (req, res, pathname) => {
  switch (pathname) {
    case '/health':
      return json(res, 200, {
        status: 'ok',
        service: 'moddex-status',
        uptimeSec: Math.round(process.uptime())
      });

    case '/api/status':
      return json(res, 200, toJson(snapshot()));

    case '/':
      return send(res, 200, 'text/html; charset=utf-8', renderPage(snapshot()));

    default: {
      const asset = ASSETS.get(pathname);

      return asset ? sendAsset(req, res, asset) : json(res, 404, { error: 'not found' });
    }
  }
};

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json(res, 405, { error: 'method not allowed' });
  }

  try {
    route(req, res, pathname);
  } catch (err) {
    log.error(`${pathname} failed`, err);
    if (!res.headersSent) json(res, 500, { error: 'internal error' });
    else res.end();
  }
});

const stopPolling = startPolling();

server.listen(config.port, () => {
  log.info(`listening on :${config.port}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log.info(`${sig} — shutting down`);
    stopPolling();
    closeStore();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}
