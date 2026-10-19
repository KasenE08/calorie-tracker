// Phase 3 end-to-end check + screenshots: week strip, past/future days, saved meals, Repeat.
// Usage: TZ=UTC node tools/e2e-phase3.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const out = `${root}/screenshots/phase-3`;
mkdirSync(out, { recursive: true });

const server = await serve();
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', timezoneId: 'UTC' });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
page.on('pageerror', e => { throw e; });

const T = s => new Date(`${s}Z`);
const shot = async (name, opts = {}) => {
  await page.locator('#toast').evaluate(t => { t.hidden = true; });
  await page.screenshot({ path: `${out}/${name}.png`, ...opts });
};
const text = sel => page.locator(sel).innerText();
const count = sel => page.locator(sel).count();
const tap = sel => page.click(sel);
const typeKeys = async s => { for (const k of s) await tap(`[data-key="${k}"]`); };
const toastText = () => page.locator('#toast').innerText();
async function swipe(dx) {
  const box = await page.locator('.week').boundingBox();
  const y = box.y + box.height / 2, x = box.x + box.width / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 }); await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
}

// ---- Seed: saved foods + earlier days this week ----
const snap = (g, c, p) => ({ servingGrams: g, cal: c, protein: p });
const foods = [
  { id: 'f-yog', name: 'Greek yogurt', ...snap(170, 150, 25) },
  { id: 'f-ban', name: 'Banana', ...snap(118, 105, 1) },
  { id: 'f-chk', name: 'Chicken breast', ...snap(100, 165, 31) },
  { id: 'f-rice', name: 'White rice, cooked', ...snap(186, 206, 4) },
  { id: 'f-whey', name: 'Whey protein', ...snap(31, 120, 24) },
  { id: 'f-sal', name: 'Salmon fillet', ...snap(100, 208, 22) },
];
let n = 0;
const q = (date, meal, name, cal, protein) => ({ id: `s${n++}`, kind: 'quick', name, date, meal, cal, protein, loggedAt: '2026-10-01T00:00:00Z' });
const entries = [
  q('2026-10-12', 'breakfast', 'Oatmeal', 400, 15), q('2026-10-12', 'lunch', 'Burrito bowl', 900, 50), q('2026-10-12', 'dinner', 'Steak + potatoes', 1100, 70),
  q('2026-10-13', 'breakfast', 'Bagel + eggs', 650, 30), q('2026-10-13', 'lunch', 'Burger + fries', 1300, 45), q('2026-10-13', 'dinner', 'Pizza', 950, 40),
  q('2026-10-14', 'breakfast', 'Protein pancakes', 520, 40), q('2026-10-14', 'lunch', 'Turkey sandwich', 610, 42),
  q('2026-10-14', 'dinner', 'Chicken stir fry', 680, 55), q('2026-10-14', 'dinner', 'Rice', 300, 6),
];
const seed = { version: 1, settings: { calGoal: 2600, proteinGoal: 180 }, foods, entries, savedMeals: [] };

await page.clock.install({ time: T('2026-10-15T07:30:00') });
await page.clock.setFixedTime(T('2026-10-15T07:30:00'));
await page.goto(url);
await page.evaluate(s => localStorage.setItem('calorie-tracker.v1', JSON.stringify(s)), seed);
await page.reload();

// ---- Week strip ----
assert.equal(await count('.week .d'), 7);
assert.deepEqual(await page.locator('.week .dow').allInnerTexts(), ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
assert.equal(await page.locator('.week .d.sel').getAttribute('data-date'), '2026-10-15');
assert.equal(await page.locator('.week .d.today').getAttribute('data-date'), '2026-10-15');
assert.equal(await page.locator('.week .d.over').getAttribute('data-date'), '2026-10-13'); // 2,900 > 2,600
assert.equal(await count('.today-pill'), 0);

// Log breakfast today (servings) so there's something to save as a meal
for (const name of ['Greek yogurt', 'Banana']) {
  await tap('[data-act="open-pick"]');
  await page.click(`#pick-list .food:has-text("${name}")`);
  await tap('[data-act="save-log"]');
}
await shot('01 Today - week strip with rings');

// ---- Past day: view + log (meal auto-fills from the clock) ----
await tap('[data-date="2026-10-13"]');
assert.equal(await text('.top .title'), 'Tuesday');
assert.equal(await text('.top .date'), 'October 13, 2026');
assert.equal(await count('.today-pill'), 1);
assert.equal(await page.locator('.hero').getAttribute('class'), 'hero over');
assert.equal(await text('[data-testid="remaining"]'), '−300');
await tap('[data-act="open-quick"]');
assert.equal(await text('.mealsel .on'), 'Breakfast'); // 7:30 AM clock
await page.fill('#q-label', 'Forgot: latte');
await page.fill('#q-cal', '190');
await page.fill('#q-pro', '10');
await tap('[data-act="save-quick"]');
assert.equal(await toastText(), 'Added to Breakfast · Tue, Oct 13');
assert.equal(await text('.top .title'), 'Tuesday');
assert.equal(await page.locator('.entry:has-text("Forgot: latte")').count(), 1);
await shot('02 Past day - over goal');

// ---- Swipe to next week: same weekday selected; future day ----
await swipe(-160);
assert.equal(await page.locator('.week .d.sel').getAttribute('data-date'), '2026-10-20');
assert.equal(await page.locator('.week .d').first().getAttribute('data-date'), '2026-10-19');
assert.equal(await text('.top .date'), 'October 20, 2026');
assert.equal(await count('[data-date="2026-10-16"]'), 0); // last week's days are gone
await tap('[data-date="2026-10-22"]');
assert.equal(await text('.top .title'), 'Thursday');
await tap('[data-act="open-quick"]');
await page.fill('#q-label', 'Planned: team lunch');
await page.fill('#q-cal', '850');
await page.fill('#q-pro', '45');
await tap('[data-act="pick-meal"][data-meal="lunch"]');
await tap('[data-act="save-quick"]');
assert.equal(await toastText(), 'Added to Lunch · Thu, Oct 22');
await shot('03 Future day - next week');

// Swipe back twice, then arrows, then the Today pill
await swipe(160);
assert.equal(await page.locator('.week .d.sel').getAttribute('data-date'), '2026-10-15');
await swipe(160);
assert.equal(await page.locator('.week .d.sel').getAttribute('data-date'), '2026-10-08');
await tap('[data-act="week"][data-dir="1"]');
assert.equal(await page.locator('.week .d.sel').getAttribute('data-date'), '2026-10-15');
await tap('[data-act="week"][data-dir="-1"]');
await tap('[data-act="go-today"]');
assert.equal(await text('.top .title'), 'Today');
assert.equal(await count('.today-pill'), 0);

// ---- Save as meal (from today's Breakfast tab) ----
await tap('[data-meal="breakfast"]');
await tap('[data-act="save-as-meal"]');
assert.equal(await text('.mealsel .on'), 'Breakfast');
assert.equal(await count('.entry'), 2);
await tap('[data-act="save-meal"]');
assert.equal(await text('#m-err'), 'Give the meal a name.');
await page.fill('#m-name', 'Usual breakfast');
await shot('04 Save as meal');
await tap('[data-act="save-meal"]');
assert.equal(await text('.pagetitle'), 'Meals');
assert.equal(await text('.section-h'), 'BREAKFAST');

// ---- Build a meal from scratch ----
await tap('[data-act="new-meal"]');
await page.fill('#m-name', 'Post-workout');
await tap('[data-act="pick-cat"][data-meal="late"]');
assert.equal(await page.inputValue('#m-name'), 'Post-workout'); // kept after re-render
await tap('[data-act="draft-add-food"]');
await page.click('#pick-list .food:has-text("Whey protein")');
assert.equal(await count('.mealsel'), 0); // no meal picker for items
await tap('[data-act="save-log"]');
await tap('[data-act="draft-add-food"]');
await page.click('#pick-list .food:has-text("Banana")');
await tap('[data-act="save-log"]');
await tap('[data-act="draft-add-quick"]');
await page.fill('#q-label', 'Milk');
await page.fill('#q-cal', '120');
await page.fill('#q-pro', '8');
await tap('[data-act="save-quick"]');
assert.equal(await count('.entry'), 3);
// Edit an item: whey → 2 servings; remove banana
await page.click('.entry-main:has-text("Whey protein")');
await typeKeys('2');
await tap('[data-act="save-log"]');
await page.click('.entry:has-text("Banana") .remove');
assert.equal(await count('.entry'), 2);
assert.equal(await text('.subtotal .c'), '360 cal');
assert.equal(await text('.subtotal .p'), '56 g');
await shot('05 New meal builder');
await tap('[data-act="save-meal"]');
assert.deepEqual(await page.locator('.section-h').allInnerTexts(), ['BREAKFAST', 'LATE NIGHT']);
await shot('06 Meals tab');

// ---- One tap: add saved meal → goes to the meal for the CURRENT time ----
await page.clock.setFixedTime(T('2026-10-15T12:30:00'));
await page.click('.mealrow:has-text("Usual breakfast") .addbtn');
assert.equal(await toastText(), 'Added Usual breakfast to Lunch');
assert.equal(await text('.tab.on .t'), 'Lunch');
assert.equal(await count('.entry'), 2);
// …and it's editable
await page.click('.entry:has-text("Banana")');
await typeKeys('2');
await tap('[data-act="save-log"]');
assert.equal(await page.locator('.entry:has-text("Banana") .c').innerText(), '210');

// Also from the Add food picker
await page.clock.setFixedTime(T('2026-10-15T22:10:00'));
await tap('[data-act="open-pick"]');
assert.equal(await count('#pick-list .mealrow'), 2);
await shot('07 Add food - saved meals');
await page.click('#pick-list .mealrow:has-text("Post-workout") .addbtn');
assert.equal(await toastText(), 'Added Post-workout to Late Night');
assert.equal(await count('.entry'), 2);

// ---- Repeat a previous day's meal → current time's meal ----
await page.clock.setFixedTime(T('2026-10-15T18:42:00'));
await tap('[data-act="open-repeat"]');
assert.equal(await page.locator('.list-h').first().innerText(), 'YESTERDAY');
await shot('08 Repeat a meal');
await page.click('[data-act="repeat-meal"][data-date="2026-10-14"][data-meal="dinner"]');
assert.equal(await toastText(), 'Copied Wed, Oct 14 Dinner to Dinner');
assert.equal(await text('.tab.on .t'), 'Dinner');
assert.equal(await count('.entry'), 2);
// Copies are independent: editing today's copy leaves yesterday alone
await page.click('.entry:has-text("Rice")');
await page.fill('#q-cal', '450');
await tap('[data-act="save-quick"]');
await tap('[data-date="2026-10-14"]');
await tap('[data-meal="dinner"]');
assert.equal(await page.locator('.entry:has-text("Rice") .c').innerText(), '300');
await tap('[data-act="go-today"]');
await tap('[data-meal="dinner"]');
await shot('09 Today after repeat');

// ---- Edit + delete a saved meal; everything persists ----
await tap('[data-tab="meals"]');
await page.click('.mealrow:has-text("Post-workout") .mid');
await page.fill('#m-name', 'Post-workout shake');
await tap('[data-act="save-meal"]');
assert.equal(await count('.mealrow:has-text("Post-workout shake")'), 1);
await page.reload();
await tap('[data-tab="meals"]');
assert.equal(await count('.mealrow'), 2);
await page.click('.mealrow:has-text("Usual breakfast") .mid');
await tap('[data-act="delete-meal"]');
assert.equal(await count('.mealrow'), 1);

await browser.close();
server.close();
console.log('Phase 3 e2e: all checks passed');
