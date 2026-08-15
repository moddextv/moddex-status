import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

const dir = mkdtempSync(join(tmpdir(), 'moddex-status-test-'));
process.env.DB_PATH = join(dir, 'status.db');

const { probe } = await import('../src/monitors.js');

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
});

const withService = async ({ status = 200, body, contentType = 'application/json' }, run) => {
  const server = createServer((req, res) => {
    const headers = contentType ? { 'content-type': contentType } : {};

    res.writeHead(status, headers).end(typeof body === 'string' ? body : JSON.stringify(body));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    return await run(`http://127.0.0.1:${server.address().port}/health`);
  } finally {
    server.close();
  }
};

const health = (service) => ({ status: 'ok', service, uptimeSec: 12 });

describe('probe', () => {
  it('is green when the expected service answers', async () => {
    const result = await withService({ body: health('moddex-web') }, (url) =>
      probe(url, 'moddex-web')
    );

    assert.equal(result.ok, true);
    assert.equal(result.error, null);
    assert.equal(result.status, 200);
  });

  it('is red, and names the culprit, when the wrong image answers', async () => {
    const result = await withService({ body: health('moddex-api') }, (url) =>
      probe(url, 'moddex-web')
    );

    assert.equal(result.ok, false);
    assert.equal(result.error, 'serving moddex-api');
  });

  it('is red when the body carries no service at all', async () => {
    const result = await withService({ body: { status: 'ok' } }, (url) => probe(url, 'moddex-web'));

    assert.equal(result.ok, false);
    assert.equal(result.error, 'no service in body');
  });

  it('does not buffer a body that is not json', async () => {
    const result = await withService({ body: 'x'.repeat(1024), contentType: 'text/html' }, (url) =>
      probe(url, 'moddex-web')
    );

    assert.equal(result.ok, false);
    assert.equal(result.error, 'no service in body');
  });

  it('is green without a service key, so a foreign endpoint can still be watched', async () => {
    const result = await withService({ body: 'anything', contentType: 'text/plain' }, (url) =>
      probe(url, undefined)
    );

    assert.equal(result.ok, true);
    assert.equal(result.error, null);
  });

  it('is red on a bad status, and does not blame the body for it', async () => {
    const result = await withService({ status: 503, body: health('moddex-api') }, (url) =>
      probe(url, 'moddex-api')
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.error, null);
  });

  it('reports a connection failure in words rather than "fetch failed"', async () => {
    const closed = await withService({ body: health('moddex-web') }, (url) => url);
    const result = await probe(closed, 'moddex-web');

    assert.equal(result.ok, false);
    assert.equal(result.error, 'connection refused');
  });
});
