// Guards the update banner: if app files change without re-stamping, phones
// would never see the update. Fix by running: npm run stamp
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { computeVersion, stampedVersion, assetList } from '../tools/stamp-version.mjs';

test('every cached asset exists', () => {
  for (const a of assetList()) assert.ok(a === './' || existsSync(new URL(`../${a}`, import.meta.url)), `missing ${a}`);
});

test('sw.js version matches the app files (run `npm run stamp`)', () => {
  assert.equal(stampedVersion(), computeVersion());
});
