import { existsSync } from 'node:fs';
const required = [
  'public/index.html',
  'public/app.js',
  'public/styles.css',
  'netlify/functions/game.ts',
  'netlify.toml',
  'package.json'
];
const missing = required.filter((p) => !existsSync(p));
if (missing.length) {
  console.error('Missing required files:', missing.join(', '));
  process.exit(1);
}
console.log('Brain Rush build package looks complete.');
