import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(here, '..', 'src', 'public', 'styles.css'), 'utf8');

const rampAfter = (selector) => {
  const start = CSS.indexOf(`${selector} {`);
  assert.ok(start > -1, `no rule matching ${selector} in styles.css`);

  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);

  return CSS.slice(open + 1, close)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--'))
    .sort();
};

describe('the light ramp is written twice', () => {
  const explicit = rampAfter("[data-theme='light']");
  const preference = rampAfter('@media (prefers-color-scheme: light)');

  it('declares the same tokens with the same values in both places', () => {
    assert.deepEqual(preference, explicit);
  });

  it('is not comparing two empty blocks', () => {
    assert.ok(explicit.length > 5, `only found ${explicit.length} declarations`);
  });
});

/*
 * The estate vocabulary. Every name here is spelled the same and holds the same
 * value in moddex-web/src/styles/globals.css and
 * moddex-api/src/public/docs.css, and each of those repos runs its own copy of
 * this table. Three deploys means no shared package, so a copy per repo is the
 * only thing that can fail loudly in whichever one drifts — and this page is
 * the one that drifted: its light theme was built by taking values off the dark
 * ramp instead of inverting it, and five of its greys were wrong for months
 * while every test here stayed green.
 *
 * Changing a value here is a change to all three. Tokens only this page has —
 * --space-*, --tip-*, --dot-size — are not estate tokens and do not belong in
 * this list.
 */
const ESTATE = {
  '--base-rgb': ['11 11 12', '255 255 255'],
  '--raised-rgb': ['17 17 19', '242 242 245'],
  '--line-rgb': ['35 35 38', '226 226 231'],
  '--line-strong-rgb': ['51 51 58', '196 196 204'],
  '--text-rgb': ['231 231 234', '24 24 27'],
  '--text-alt-rgb': ['138 138 147', '110 110 120'],
  '--text-dim-rgb': ['85 85 95', '154 154 164'],
  '--mod-rgb': ['74 222 128', '22 101 52'],
  '--vip-rgb': ['244 114 182', '190 24 93'],
  '--founder-rgb': ['251 191 36', '146 64 14'],
  '--radius-xs': ['4px', '4px'],
  '--radius-sm': ['6px', '6px'],
  '--radius-md': ['8px', '8px'],
  '--radius-lg': ['12px', '12px'],
  '--radius-full': ['9999px', '9999px'],
  '--ease': ['cubic-bezier(0.2, 0, 0, 1)', 'cubic-bezier(0.2, 0, 0, 1)'],
  '--duration': ['150ms', '150ms'],
  '--brand-mark': ['24px', '24px'],
  '--brand-gap': ['12px', '12px']
};

const parse = (selector) => {
  const start = CSS.indexOf(`${selector} {`);
  assert.ok(start > -1, `no rule matching ${selector} in styles.css`);

  const open = CSS.indexOf('{', start);

  return Object.fromEntries(
    CSS.slice(open + 1, CSS.indexOf('\n}', open))
      .split('\n')
      .map((line) => line.trim().match(/^(--[\w-]+):\s*(.+);$/))
      .filter((match) => match !== null)
      .map((match) => [match[1], match[2]])
  );
};

describe('the estate vocabulary', () => {
  const dark = parse(':root');
  const light = { ...dark, ...parse("[data-theme='light']") };

  for (const [name, expected] of Object.entries(ESTATE)) {
    it(`${name} is the estate value in both themes`, () => {
      assert.deepEqual([dark[name], light[name]], expected);
    });
  }
});
