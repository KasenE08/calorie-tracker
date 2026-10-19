// Computes the app version from the contents of every cached file and writes it
// into sw.js and js/version.js. Run before pushing app changes: npm run stamp
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const STAMPED = ['sw.js', 'js/version.js']; // excluded from the hash (they hold it)

export function assetList() {
  const sw = readFileSync(`${root}/sw.js`, 'utf8');
  return JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
}

export function computeVersion() {
  const h = createHash('sha256');
  for (const a of assetList()) {
    const file = a === './' ? 'index.html' : a;
    if (STAMPED.includes(file)) continue;
    h.update(file).update(readFileSync(`${root}/${file}`));
  }
  h.update(readFileSync(`${root}/sw.js`, 'utf8').replace(/const VERSION = '[^']*';/, '')); // SW logic counts too
  return h.digest('hex').slice(0, 8);
}

export function stampedVersion() {
  return readFileSync(`${root}/sw.js`, 'utf8').match(/const VERSION = '([^']*)';/)[1];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const v = computeVersion();
  for (const f of STAMPED) {
    const p = `${root}/${f}`;
    writeFileSync(p, readFileSync(p, 'utf8').replace(/(const VERSION = ')[^']*(';)/, `$1${v}$2`));
  }
  console.log(`version ${v}`);
}
