// Phase 4 end-to-end check + screenshots: PWA install bits, offline, update banner,
// export/import, portrait. Usage: TZ=UTC node tools/e2e-phase4.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const out = `${root}/screenshots/phase-4`;
const tmp = `${root}/node_modules/.e2e`;
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });

const overrides = {};
const server = await serve(0, overrides);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const opts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', timezoneId: 'UTC', acceptDownloads: true };

async function newPage() {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { delete Navigator.prototype.canShare; }); // test the download path
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => { throw e; });
  await page.clock.install({ time: new Date('2026-10-15T18:42:00Z') });
  await page.clock.setFixedTime(new Date('2026-10-15T18:42:00Z'));
  return { ctx, page };
}
const shot = async (page, name) => {
  await page.locator('#toast').evaluate(t => { t.hidden = true; });
  await page.screenshot({ path: `${out}/${name}.png` });
};
const controlled = page => page.waitForFunction(() => !!navigator.serviceWorker.controller);

// ---- Seed a realistic week ----
let n = 0;
const q = (date, meal, name, cal, protein) => ({ id: `s${n++}`, kind: 'quick', name, date, meal, cal, protein, loggedAt: '2026-10-01T00:00:00Z' });
const chicken = { servingGrams: 100, cal: 165, protein: 31 };
const seed = {
  version: 1, settings: { calGoal: 2600, proteinGoal: 180 },
  foods: [{ id: 'f1', name: 'Chicken breast', ...chicken }, { id: 'f2', name: 'Greek yogurt', servingGrams: 170, cal: 150, protein: 25 }],
  savedMeals: [{ id: 'm1', name: 'Usual breakfast', category: 'breakfast', items: [{ kind: 'quick', name: 'Yogurt bowl', cal: 315, protein: 29 }] }],
  entries: [
    q('2026-10-12', 'lunch', 'Burrito bowl', 2400, 140), q('2026-10-13', 'dinner', 'Pizza night', 2900, 120), q('2026-10-14', 'dinner', 'Stir fry', 2200, 150),
    q('2026-10-15', 'breakfast', 'Yogurt bowl', 315, 29),
    { id: 'e1', kind: 'food', foodId: 'f1', name: 'Chicken breast', unit: 'grams', amount: 200, snapshot: chicken, cal: 330, protein: 62, date: '2026-10-15', meal: 'lunch', loggedAt: '2026-10-15T12:30:00Z' },
    q('2026-10-15', 'lunch', 'Rice + broccoli', 365, 10), q('2026-10-15', 'dinner', 'Salmon + sweet potato', 490, 37), q('2026-10-15', 'dinner', 'Ice cream', 220, 4),
  ],
};

const { ctx, page } = await newPage();
await page.goto(url);
await page.evaluate(s => localStorage.setItem('calorie-tracker.v1', JSON.stringify(s)), seed);
await page.reload();
await controlled(page);

// ---- Install bits ----
const manifest = await page.evaluate(async () => (await fetch('manifest.json')).json());
assert.equal(manifest.name, 'Calorie Tracker');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.orientation, 'portrait');
for (const icon of manifest.icons) assert.equal(await page.evaluate(src => fetch(src).then(r => r.status), icon.src), 200);
assert.equal(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), 'icons/icon-180.png');
assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-title"]', 'content'), 'Calorie Tracker');
assert.equal(await page.isHidden('#update'), true);
await page.click('[data-meal="dinner"]');
await shot(page, '01 Today');

// ---- Fully offline ----
await ctx.setOffline(true);
await page.reload();
assert.equal(await page.innerText('.top .title'), 'Today');
await page.click('[data-act="open-quick"]');
await page.fill('#q-label', 'Offline snack');
await page.fill('#q-cal', '150');
await page.fill('#q-pro', '6');
await page.click('[data-act="save-quick"]');
assert.equal(await page.locator('.entry:has-text("Offline snack")').count(), 1);
await ctx.setOffline(false);

// ---- Update banner: deploy a "new version" and come back to the app ----
const sw = readFileSync(`${root}/sw.js`, 'utf8');
overrides['/sw.js'] = sw.replace(/const VERSION = '[^']*';/, "const VERSION = 'test-v2';");
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // like reopening the app
await page.waitForSelector('#update:not([hidden])', { timeout: 15000 });
await shot(page, '02 Update banner');
await Promise.all([page.waitForEvent('load'), page.click('#update-btn')]);
await controlled(page);
assert.deepEqual(await page.evaluate(() => caches.keys()), ['calorie-tracker-test-v2']);
assert.equal(await page.isHidden('#update'), true);
assert.equal(await page.locator('.entry:has-text("Offline snack")').count(), 1); // data kept
delete overrides['/sw.js'];

// ---- Export ----
await page.click('[data-tab="settings"]');
await shot(page, '03 Settings - backup');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
assert.equal(download.suggestedFilename(), 'calorie-tracker-backup-2026-10-15.json');
const file = `${tmp}/backup.json`;
await download.saveAs(file);
const backup = JSON.parse(readFileSync(file, 'utf8'));
assert.equal(backup.app, 'calorie-tracker');
assert.equal(backup.entries.length, seed.entries.length + 1);
assert.equal(backup.foods.length, 2);
assert.equal(backup.savedMeals.length, 1);

// ---- Import on a "new phone" ----
const fresh = await newPage();
const p2 = fresh.page;
await p2.goto(url);
await p2.click('[data-tab="settings"]');
// Wrong file first
const junk = `${tmp}/junk.json`;
(await import('node:fs')).writeFileSync(junk, JSON.stringify({ hello: 'world' }));
let [chooser] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('[data-act="import"]')]);
await chooser.setFiles(junk);
await p2.waitForSelector('#import-err:has-text("isn’t a Calorie Tracker backup")');
// Real backup → confirm step → Cancel keeps data
[chooser] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('[data-act="import"]')]);
await chooser.setFiles(file);
await p2.waitForSelector('.confirm-box');
assert.match(await p2.innerText('.confirm-box'), /9 logged entries over 4 days \(Oct 12, 2026 – Oct 15, 2026\)/);
await shot(p2, '04 Import - confirm');
await p2.click('.actions [data-act="back"]');
await p2.click('[data-tab="today"]');
assert.equal(await p2.innerText('[data-testid="cal-val"]'), '0 / 2,600 cal');
// Confirm → replaced
await p2.click('[data-tab="settings"]');
[chooser] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('[data-act="import"]')]);
await chooser.setFiles(file);
await p2.click('[data-act="import-confirm"]');
assert.equal(await p2.innerText('[data-testid="cal-val"]'), '1,870 / 2,600 cal');
assert.equal(await p2.locator('.week .d.over').getAttribute('data-date'), '2026-10-13');
await p2.click('[data-tab="meals"]');
assert.equal(await p2.locator('.mealrow').count(), 1);

// ---- Portrait only ----
await page.setViewportSize({ width: 844, height: 390 });
assert.equal(await page.isVisible('.rotate'), true);
await page.screenshot({ path: `${out}/05 Landscape - turn upright.png` });
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(await page.isVisible('.rotate'), false);

await browser.close();
server.close();
console.log('Phase 4 e2e: all checks passed');
