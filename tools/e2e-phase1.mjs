// Phase 1 end-to-end check + screenshots. Drives the real UI with a fake clock.
// Usage: TZ=UTC node tools/e2e-phase1.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const out = `${root}/screenshots/phase-1`;
mkdirSync(out, { recursive: true });

const server = await serve();
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
// Dark mode on purpose: the app must stay white.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', timezoneId: 'UTC' });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
page.on('pageerror', e => { throw e; });

const T = s => new Date(`${s}Z`); // UTC, matches timezoneId
const shot = async name => {
  await page.locator('#toast').evaluate(t => { t.hidden = true; });
  await page.screenshot({ path: `${out}/${name}.png` });
};
const tap = sel => page.click(sel);
const text = sel => page.locator(sel).innerText();
const typeKeys = async s => { for (const k of s) await tap(`[data-key="${k}"]`); };

async function createFood(name, grams, cal, protein, { shotName } = {}) {
  await page.fill('#f-name', name);
  await page.fill('#f-grams', String(grams));
  await page.fill('#f-cal', String(cal));
  await page.fill('#f-pro', String(protein));
  if (shotName) await shot(shotName);
  await tap('[data-act="save-food"]');
}

// ---- Thu Oct 15, 7:30 AM: empty day opens on Breakfast ----
await page.clock.install({ time: T('2026-10-15T07:30:00') });
await page.clock.setFixedTime(T('2026-10-15T07:30:00'));
await page.goto(url);
assert.equal(await text('.top .title'), 'Today');
assert.equal(await text('.top .date'), 'Thursday, Oct 15');
assert.equal(await text('.tab.on .t'), 'Breakfast');
await shot('01 Today - empty');

// ---- Saved foods: create ----
await tap('[data-tab="foods"]');
await tap('[data-act="new-food"]');
await createFood('Chicken breast', 100, 165, 31, { shotName: '02 New food form' });
await tap('[data-act="new-food"]'); await createFood('Greek yogurt', 170, 150, 25);
await tap('[data-act="new-food"]'); await createFood('White rice, cooked', 186, 206, 4);
await tap('[data-act="new-food"]'); await createFood('Banana', 118, 105, 1);
await tap('[data-act="new-food"]'); await createFood('Whey protein', 31, 120, 24);
await tap('[data-act="new-food"]'); await createFood('Chicken thigh', 100, 209, 26);
await tap('[data-act="new-food"]'); await createFood('Salmon fillet', 100, 208, 22);
assert.equal(await page.locator('#foods-list .food').count(), 7);
await shot('03 Foods list');

// Validation
await tap('[data-act="new-food"]');
await tap('[data-act="save-food"]');
assert.equal(await text('#f-err'), 'Enter a name.');
await tap('[data-act="back"]');

// Search
await page.fill('#foods-search', 'chick');
assert.equal(await page.locator('#foods-list .food').count(), 2);
await shot('04 Foods search');
await page.fill('#foods-search', '');

// ---- Log breakfast at 7:30 AM (servings) ----
await tap('[data-tab="today"]');
await tap('[data-act="open-pick"]');
await shot('05 Add food picker');
await page.click('#pick-list .food:has-text("Greek yogurt")');
assert.equal(await text('.mealsel .on'), 'Breakfast'); // auto from clock
await tap('[data-act="save-log"]');
await tap('[data-act="open-pick"]');
await page.click('#pick-list .food:has-text("Banana")');
await tap('[data-act="save-log"]');
assert.equal(await text('.tab.on .t'), 'Breakfast');
assert.equal(await page.locator('.entry').count(), 2);
await tap('[data-act="open-quick"]');
await page.fill('#q-label', 'Coffee w/ milk');
await page.fill('#q-cal', '60');
await page.fill('#q-pro', '3');
await shot('06 Quick add');
await tap('[data-act="save-quick"]');
assert.equal(await text('.subtotal .c'), '315 cal');
assert.equal(await text('.subtotal .p'), '29 g');

// ---- Lunch at 12:30 PM: grams + servings ----
await page.clock.setFixedTime(T('2026-10-15T12:30:00'));
await tap('[data-act="open-pick"]');
await page.fill('#pick-search', 'breast');
await page.click('#pick-list .food:has-text("Chicken breast")');
assert.equal(await text('.mealsel .on'), 'Lunch');
await tap('[data-unit="grams"]');
assert.equal(await text('[data-testid="amount"]'), '100'); // 1 serving → 100 g
await typeKeys('200');
await tap('[data-act="save-log"]');
await tap('[data-act="open-pick"]');
await page.click('#pick-list .food:has-text("White rice")');
await typeKeys('1.5');
assert.equal(await text('.res .rc b'), '309');
assert.equal(await text('.res .rp b'), '6 g');
await shot('07 Log food - servings');
await tap('[data-act="save-log"]');

// ---- Dinner at 6:42 PM ----
await page.clock.setFixedTime(T('2026-10-15T18:42:00'));
await tap('[data-act="open-pick"]');
await page.click('#pick-list .food:has-text("Salmon")');
assert.equal(await text('.mealsel .on'), 'Dinner');
await tap('[data-unit="grams"]');
await typeKeys('150');
assert.equal(await text('.res .rc b'), '312');
assert.equal(await text('.res .rp b'), '33 g');
await shot('08 Log food - grams');
await tap('[data-act="save-log"]');
await tap('[data-act="open-quick"]');
await page.fill('#q-label', 'Ice cream');
await page.fill('#q-cal', '220');
await page.fill('#q-pro', '4');
await tap('[data-act="save-quick"]');

// ---- Late night at 10:15 PM (same date) ----
await page.clock.setFixedTime(T('2026-10-15T22:15:00'));
await tap('[data-act="open-quick"]');
assert.equal(await text('.mealsel .on'), 'Late Night');
await page.fill('#q-label', 'Popcorn');
await page.fill('#q-cal', '120');
await page.fill('#q-pro', '0');
await tap('[data-act="save-quick"]');
assert.equal(await text('.tab.on .t'), 'Late Night');

await tap('[data-meal="dinner"]');
await shot('09 Today - Dinner tab');
await tap('[data-meal="lunch"]');
await shot('10 Today - Lunch tab');
assert.equal(await text('[data-testid="cal-val"]'), '1,606 / 2,600 cal');
assert.equal(await text('[data-testid="pro-val"]'), '134 / 180 g');

// ---- Edit an entry: change amount + move meal ----
await page.click('.entry:has-text("Chicken breast")');
await shot('11 Edit entry');
await typeKeys('180');
await tap('[data-act="pick-meal"][data-meal="dinner"]');
await tap('[data-act="save-log"]');
assert.equal(await text('.tab.on .t'), 'Dinner');
const moved = page.locator('.entry:has-text("Chicken breast")');
assert.equal(await moved.locator('.q').innerText(), '180 g');
assert.equal(await moved.locator('.c').innerText(), '297');

// Edit a quick add
await page.click('.entry:has-text("Ice cream")');
await page.fill('#q-cal', '250');
await tap('[data-act="save-quick"]');
assert.equal(await page.locator('.entry:has-text("Ice cream") .c').innerText(), '250');

// ---- Editing a saved food doesn't change logged entries ----
await tap('[data-tab="foods"]');
await page.click('#foods-list .food:has-text("Chicken breast")');
await page.fill('#f-cal', '999');
await shot('12 Edit food');
await tap('[data-act="save-food"]');
await tap('[data-tab="today"]');
await tap('[data-meal="dinner"]');
assert.equal(await page.locator('.entry:has-text("Chicken breast") .c').innerText(), '297');

// Delete an entry
await page.click('.entry:has-text("Ice cream")');
await tap('[data-act="delete-entry"]');
assert.equal(await page.locator('.entry:has-text("Ice cream")').count(), 0);

// ---- Data survives reload ----
await page.reload();
await tap('[data-meal="dinner"]');
assert.equal(await page.locator('.entry').count(), 2);

// ---- 1:00 AM Friday: app opens to Thursday, Late Night ----
await page.clock.setFixedTime(T('2026-10-16T01:00:00'));
await page.reload();
assert.equal(await text('.top .date'), 'Thursday, Oct 15');
assert.equal(await text('.top .title'), 'Today');
assert.equal(await text('.tab.on .t'), 'Late Night');
await tap('[data-act="open-quick"]');
await page.fill('#q-label', 'Protein bar');
await page.fill('#q-cal', '200');
await page.fill('#q-pro', '20');
await tap('[data-act="save-quick"]');
assert.equal(await page.locator('.entry').count(), 2); // popcorn + protein bar on Thursday
await shot('13 1 AM - opens previous day');

// ---- 4:01 AM Friday: new day ----
await page.clock.setFixedTime(T('2026-10-16T04:01:00'));
await page.reload();
assert.equal(await text('.top .date'), 'Friday, Oct 16');
assert.equal(await text('.tab.on .t'), 'Breakfast');
assert.equal(await text('[data-testid="remaining"]'), '2,600');
await shot('14 4-01 AM - new day');

await browser.close();
server.close();
console.log('Phase 1 e2e: all checks passed');
