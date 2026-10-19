// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mealForTime, appDateFor, scale, convertAmount, totals, searchFoods, addDays } from '../js/logic.js';

// Local time on Thu Oct 15, 2026 (seconds optional)
const at = (h, m, s = 0) => new Date(2026, 9, 15, h, m, s);

const cases = [
  // [label, time, meal, app date]
  ['12:00 AM', at(0, 0), 'late', '2026-10-14'],
  ['12:01 AM', at(0, 1), 'late', '2026-10-14'],
  ['1:00 AM', at(1, 0), 'late', '2026-10-14'],
  ['4:00 AM', at(4, 0), 'late', '2026-10-14'],
  ['4:01 AM', at(4, 1), 'breakfast', '2026-10-15'],
  ['5:59 AM', at(5, 59), 'breakfast', '2026-10-15'],
  ['6:00 AM', at(6, 0), 'breakfast', '2026-10-15'],
  ['11:00 AM', at(11, 0), 'breakfast', '2026-10-15'],
  ['11:01 AM', at(11, 1), 'lunch', '2026-10-15'],
  ['4:00 PM', at(16, 0), 'lunch', '2026-10-15'],
  ['4:01 PM', at(16, 1), 'dinner', '2026-10-15'],
  ['9:00 PM', at(21, 0), 'dinner', '2026-10-15'],
  ['9:01 PM', at(21, 1), 'late', '2026-10-15'],
  ['11:59 PM', at(23, 59), 'late', '2026-10-15'],
];

for (const [label, time, meal, date] of cases) {
  test(`${label} → ${meal} on ${date}`, () => {
    assert.equal(mealForTime(time), meal);
    assert.equal(appDateFor(time), date);
  });
}

test('seconds are ignored (goes by the minute)', () => {
  assert.equal(mealForTime(at(11, 0, 59)), 'breakfast');
  assert.equal(mealForTime(at(16, 0, 59)), 'lunch');
  assert.equal(mealForTime(at(21, 0, 59)), 'dinner');
  assert.equal(mealForTime(at(4, 0, 59)), 'late');
  assert.equal(appDateFor(at(4, 0, 59)), '2026-10-14');
});

test('late night rolls back across month and year boundaries', () => {
  assert.equal(appDateFor(new Date(2026, 10, 1, 1, 0)), '2026-10-31');
  assert.equal(appDateFor(new Date(2027, 0, 1, 0, 30)), '2026-12-31');
  assert.equal(appDateFor(new Date(2028, 2, 1, 2, 0)), '2028-02-29'); // leap year
});

test('addDays', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

const chicken = { servingGrams: 100, cal: 165, protein: 31 };

test('scale by servings', () => {
  assert.deepEqual(scale(chicken, 'servings', 1.5), { cal: 248, protein: 47 });
  assert.deepEqual(scale(chicken, 'servings', 0), { cal: 0, protein: 0 });
});

test('scale by grams, protein in whole grams', () => {
  assert.deepEqual(scale(chicken, 'grams', 220), { cal: 363, protein: 68 });
  assert.deepEqual(scale({ servingGrams: 186, cal: 206, protein: 4 }, 'grams', 279), { cal: 309, protein: 6 });
});

test('convert between servings and grams', () => {
  assert.equal(convertAmount(chicken, 'servings', 'grams', 1.5), 150);
  assert.equal(convertAmount(chicken, 'grams', 'servings', 220), 2.2);
  assert.equal(convertAmount({ servingGrams: 30 }, 'grams', 'servings', 100), 3.33);
});

test('totals', () => {
  assert.deepEqual(totals([{ cal: 100, protein: 5 }, { cal: 250, protein: 30 }]), { cal: 350, protein: 35 });
  assert.deepEqual(totals([]), { cal: 0, protein: 0 });
});

test('searchFoods is case-insensitive and sorted', () => {
  const foods = [{ name: 'White rice' }, { name: 'Chicken thigh' }, { name: 'chicken breast' }];
  assert.deepEqual(searchFoods(foods, 'CHICK').map(f => f.name), ['chicken breast', 'Chicken thigh']);
  assert.equal(searchFoods(foods, '  ').length, 3);
});
