/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import('prettier').Config}
 */
const config = {
  singleQuote: true,
  semi: true,
  trailingComma: 'none',
  tabWidth: 2,
  bracketSameLine: false,
  endOfLine: 'lf',
  printWidth: 100,
  arrowParens: 'always',
  overrides: [
    {
      files: '*.css',
      options: { useTabs: true }
    }
  ]
};

export default config;
