import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const TYPES = {
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff2: 'font/woff2'
};

export const ASSET_MAX_AGE = 300;

const load = (name) => {
  const body = readFileSync(new URL(`./public/${name}`, import.meta.url));

  return [
    `/${name}`,
    {
      body,
      type: TYPES[name.split('.').pop()],
      etag: `"${createHash('sha256').update(body).digest('base64url').slice(0, 16)}"`
    }
  ];
};

export const ASSETS = new Map(
  ['styles.css', 'script.js', 'favicon.svg', 'favicon.ico', 'fonts/manrope-latin.woff2'].map(load)
);
