// Device storage (localStorage). One JSON blob, versioned for future migrations.
import { scale } from './logic.js';

const KEY = 'calorie-tracker.v1';

const empty = () => ({
  version: 1,
  settings: { calGoal: null, proteinGoal: null },
  foods: [],   // { id, name, servingGrams, cal, protein }
  entries: [], // see logFood / quickAdd below
  savedMeals: [],
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch { /* corrupted or blocked storage: start fresh */ }
  return empty();
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const getState = () => state;

// ---------- Saved foods ----------
export function getFood(id) {
  return state.foods.find(f => f.id === id);
}

export function saveFood({ id, name, servingGrams, cal, protein }) {
  const food = { id: id || uid(), name: name.trim(), servingGrams, cal, protein };
  const i = state.foods.findIndex(f => f.id === food.id);
  if (i >= 0) state.foods[i] = food; else state.foods.push(food);
  save();
  return food;
}

export function deleteFood(id) {
  state.foods = state.foods.filter(f => f.id !== id);
  save();
}

// ---------- Entries ----------
// Every entry keeps a snapshot of the food's values at log time, so editing or
// deleting the saved food never changes what was already logged.
export function logFood(food, { date, meal, unit, amount }) {
  const snapshot = { servingGrams: food.servingGrams, cal: food.cal, protein: food.protein };
  const entry = {
    id: uid(), kind: 'food', foodId: food.id, name: food.name,
    date, meal, unit, amount, snapshot, ...scale(snapshot, unit, amount),
    loggedAt: new Date().toISOString(),
  };
  state.entries.push(entry);
  save();
  return entry;
}

export function quickAdd({ date, meal, label, cal, protein }) {
  const entry = {
    id: uid(), kind: 'quick', name: label.trim() || 'Quick add',
    date, meal, cal, protein, loggedAt: new Date().toISOString(),
  };
  state.entries.push(entry);
  save();
  return entry;
}

export function getEntry(id) {
  return state.entries.find(e => e.id === id);
}

export function updateEntry(id, changes) {
  const e = getEntry(id);
  if (!e) return;
  Object.assign(e, changes);
  if (e.kind === 'food') Object.assign(e, scale(e.snapshot, e.unit, e.amount));
  save();
}

export function deleteEntry(id) {
  state.entries = state.entries.filter(e => e.id !== id);
  save();
}

export function entriesFor(date) {
  return state.entries.filter(e => e.date === date);
}
