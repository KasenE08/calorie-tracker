// Device storage (localStorage). One JSON blob, versioned for future migrations.
import { scale, entryFieldsFromItem } from './logic.js';

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

// ---------- Goals ----------
// Placeholders until changed in Settings; the same goal applies every day.
export const DEFAULT_GOALS = { calGoal: 2600, proteinGoal: 180 };

export function getGoals() {
  const s = state.settings || {};
  return { calGoal: s.calGoal ?? DEFAULT_GOALS.calGoal, proteinGoal: s.proteinGoal ?? DEFAULT_GOALS.proteinGoal };
}

export function saveGoals({ calGoal, proteinGoal }) {
  state.settings = { ...state.settings, calGoal, proteinGoal };
  save();
}

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

// Add several entries at once (saved meal or Repeat). Each becomes a normal,
// editable entry with its own copy of the values.
export function addEntries(items, { date, meal }) {
  const loggedAt = new Date().toISOString();
  for (const item of items) state.entries.push({ id: uid(), ...entryFieldsFromItem(item), date, meal, loggedAt });
  save();
}

// ---------- Saved meals ----------
// { id, name, category, items: [{ kind:'food', foodId, name, unit, amount, snapshot } | { kind:'quick', name, cal, protein }] }
export function getMeal(id) {
  return state.savedMeals.find(m => m.id === id);
}

export function saveMeal({ id, name, category, items }) {
  const meal = { id: id || uid(), name: name.trim(), category, items: structuredClone(items) };
  const i = state.savedMeals.findIndex(m => m.id === meal.id);
  if (i >= 0) state.savedMeals[i] = meal; else state.savedMeals.push(meal);
  save();
  return meal;
}

export function deleteMeal(id) {
  state.savedMeals = state.savedMeals.filter(m => m.id !== id);
  save();
}

// Items of a saved meal, using the latest values of any saved food that still exists.
export function mealItemsForAdding(meal) {
  return meal.items.map(it => {
    const food = it.kind === 'food' && getFood(it.foodId);
    if (!food) return it;
    return { ...it, name: food.name, snapshot: { servingGrams: food.servingGrams, cal: food.cal, protein: food.protein } };
  });
}

// ---------- Backup ----------
export function exportData() {
  return { app: 'calorie-tracker', exportedAt: new Date().toISOString(), ...structuredClone(state) };
}

// `data` must already be validated (logic.validateBackup). Replaces everything.
export function replaceAll(data) {
  state = { ...empty(), ...structuredClone(data) };
  save();
}
