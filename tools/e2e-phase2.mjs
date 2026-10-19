// Phase 2 end-to-end check + screenshots: goals, big number, bars.
// Usage: TZ=UTC node tools/e2e-phase2.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const out = `${root}/screenshots/phase-2`;
mkdirSync(out, { recursive: true });

const server = await serve();
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', timezoneId: 'UTC' });
const page = await ctx.newPage();
page.on('pageerror', e => { throw e; });

const shot = async name => {
  await page.locator('#toast').evaluate(t => { t.hidden = true; });
  await page.screenshot({ path: `${out}/${name}.png` });
};
const text = sel => page.locator(sel).innerText();
const remaining = () => text('[data-testid="remaining"]');
const isRed = () => page.locator('.hero').evaluate(h => h.classList.contains('over'));
const color = sel => page.locator(sel).evaluate(el => getComputedStyle(el).color);
const bg = sel => page.locator(sel).evaluate(el => getComputedStyle(el).backgroundColor);
const BLUE = 'rgb(26, 108, 240)', RED = 'rgb(224, 50, 43)';

async function quickAdd(label, cal, protein, meal) {
  await page.click('[data-act="open-quick"]');
  await page.fill('#q-label', label);
  await page.fill('#q-cal', String(cal));
  await page.fill('#q-pro', String(protein));
  if (meal) await page.click(`[data-act="pick-meal"][data-meal="${meal}"]`);
  await page.click('[data-act="save-quick"]');
}

await page.clock.install({ time: new Date('2026-10-15T18:42:00Z') });
await page.clock.setFixedTime(new Date('2026-10-15T18:42:00Z'));
await page.goto(url);

// First launch: placeholder goals
assert.equal(await remaining(), '2,600');
assert.equal(await text('[data-testid="cal-val"]'), '0 / 2,600 cal');
assert.equal(await text('[data-testid="pro-val"]'), '0 / 180 g');
await page.click('[data-tab="settings"]');
assert.equal(await page.inputValue('#g-cal'), '2600');
assert.equal(await page.inputValue('#g-pro'), '180');
await shot('01 Settings - placeholder goals');

// Validation
await page.fill('#g-cal', '0');
await page.click('[data-act="save-goals"]');
assert.equal(await text('#g-err'), 'Enter a calorie goal above 0.');
await page.fill('#g-cal', '2600');
await page.click('[data-act="save-goals"]');
assert.equal(await text('#g-err'), '');
await page.click('[data-tab="today"]');

// Under goal
await quickAdd('Greek yogurt + banana', 255, 26, 'breakfast');
await quickAdd('Coffee w/ milk', 60, 3, 'breakfast');
await quickAdd('Chicken + rice', 640, 68, 'lunch');
await quickAdd('Broccoli', 55, 4, 'lunch');
await quickAdd('Salmon + sweet potato', 490, 37, 'dinner');
await quickAdd('Ice cream', 220, 4, 'dinner');
await quickAdd('Popcorn', 120, 0, 'late');
await page.click('[data-meal="dinner"]');
assert.equal(await remaining(), '760');
assert.equal(await text('[data-testid="cal-val"]'), '1,840 / 2,600 cal');
assert.equal(await text('[data-testid="pro-val"]'), '142 / 180 g');
assert.equal(await isRed(), false);
assert.equal(await color('[data-testid="remaining"]'), BLUE);
await shot('02 Under goal');

// Near goal: still blue
await quickAdd('Protein shake', 700, 30, 'dinner');
assert.equal(await remaining(), '60');
assert.equal(await isRed(), false);
await shot('03 Near goal');

// Exactly at goal: 0, still blue
await quickAdd('Apple', 60, 0, 'dinner');
assert.equal(await remaining(), '0');
assert.equal(await isRed(), false);
assert.equal(await color('[data-testid="remaining"]'), BLUE);

// Over goal: negative + red (protein over too: bar stays orange, capped full)
await quickAdd('Cookies', 180, 2, 'late');
await page.click('[data-meal="late"]');
assert.equal(await remaining(), '−180');
assert.equal(await isRed(), true);
assert.equal(await color('[data-testid="remaining"]'), RED);
assert.equal(await bg('.bar.cal .fill'), RED);
assert.equal(await bg('.bar.pro .fill'), 'rgb(255, 138, 0)');
assert.equal(await page.locator('.bar.cal .fill').getAttribute('style'), 'width:100.0%');
await shot('04 Over goal');

// Big negative number still fits
await quickAdd('Pizza', 1100, 40, 'late');
assert.equal(await remaining(), '−1,280');
const box = await page.locator('[data-testid="remaining"]').boundingBox();
const hero = await page.locator('.hero > div').first().boundingBox();
assert.ok(box.x + box.width <= hero.x + hero.width + 1, 'big number overflows its column');
await shot('05 Way over goal');

// Changing the goal updates the day; persists after reload
await page.click('[data-tab="settings"]');
await page.fill('#g-cal', '4000');
await page.fill('#g-pro', '200');
await page.click('[data-act="save-goals"]');
await shot('06 Settings - goals changed');
await page.reload();
assert.equal(await remaining(), '120');
assert.equal(await isRed(), false);
assert.equal(await text('[data-testid="pro-val"]'), '214 / 200 g');

await browser.close();
server.close();
console.log('Phase 2 e2e: all checks passed');
