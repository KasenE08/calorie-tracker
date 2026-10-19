// Pure logic: meal windows, app day, scaling, totals. No DOM, no storage.
// Shared by the app (browser) and the tests (node --test).

export const MEALS = ['breakfast', 'lunch', 'dinner', 'late'];
export const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', late: 'Late Night' };

// Meal windows, in minutes after midnight, end-inclusive (seconds are ignored):
//   Breakfast  4:01 AM – 11:00 AM
//   Lunch     11:01 AM –  4:00 PM
//   Dinner     4:01 PM –  9:00 PM
//   Late Night 9:01 PM –  4:00 AM (12:00–4:00 AM counts toward the previous date)
const DAY_START = 4 * 60 + 1; // 4:01 AM — the app day starts here

const minuteOfDay = d => d.getHours() * 60 + d.getMinutes();

export function mealForTime(d) {
  const m = minuteOfDay(d);
  if (m >= DAY_START && m <= 11 * 60) return 'breakfast';
  if (m >= 11 * 60 + 1 && m <= 16 * 60) return 'lunch';
  if (m >= 16 * 60 + 1 && m <= 21 * 60) return 'dinner';
  return 'late';
}

// The calendar date (YYYY-MM-DD, local time) this moment belongs to.
// Before 4:01 AM it still belongs to the previous date.
export function appDateFor(d) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (minuteOfDay(d) < DAY_START) day.setDate(day.getDate() - 1);
  return toISODate(day);
}

export function toISODate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// Scale a food's per-serving values to an amount in servings or grams.
// Calories and protein are whole numbers.
export function scale(snapshot, unit, amount) {
  const servings = unit === 'grams' ? amount / snapshot.servingGrams : amount;
  return {
    cal: Math.round(snapshot.cal * servings),
    protein: Math.round(snapshot.protein * servings),
  };
}

export function convertAmount(snapshot, fromUnit, toUnit, amount) {
  if (fromUnit === toUnit) return amount;
  if (toUnit === 'grams') return round(amount * snapshot.servingGrams, 0);
  return round(amount / snapshot.servingGrams, 2);
}

export function round(n, places) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function totals(entries) {
  return entries.reduce((t, e) => ({ cal: t.cal + e.cal, protein: t.protein + e.protein }), { cal: 0, protein: 0 });
}

export function searchFoods(foods, query) {
  const q = query.trim().toLowerCase();
  const list = q ? foods.filter(f => f.name.toLowerCase().includes(q)) : foods.slice();
  return list.sort((a, b) => a.name.localeCompare(b.name));
}
