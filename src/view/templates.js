import { readFileSync, readdirSync } from 'node:fs';

import Mustache from '../vendor/mustache.mjs';

const DIR = new URL('./templates/', import.meta.url);
const SUFFIX = '.mustache';

/** @type {Record<string, string>} */
const templates = Object.fromEntries(
  readdirSync(DIR)
    .filter((file) => file.endsWith(SUFFIX))
    .map((file) => [file.slice(0, -SUFFIX.length), readFileSync(new URL(file, DIR), 'utf8')])
);

for (const [name, source] of Object.entries(templates)) {
  try {
    Mustache.parse(source);
  } catch (err) {
    throw new Error(`template ${name}${SUFFIX} is malformed: ${err.message}`, { cause: err });
  }
}

export const render = (name, view) => {
  const template = templates[name];
  if (template === undefined) throw new Error(`no template named ${name}`);

  return Mustache.render(template, view, templates);
};
