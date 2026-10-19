import * as L from './logic.js';
import * as S from './store.js';

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
const now = () => new Date();
const today = () => L.appDateFor(now());
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shortDate = iso => L.fromISODate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// UI state. `stack` holds pages opened on top of the current bottom tab.
const ui = {
  tab: 'today',
  date: today(),
  mealTab: L.mealForTime(now()),
  stack: [],
  slide: '', // week strip animation after a swipe
};
const page = () => ui.stack[ui.stack.length - 1];
const draftPage = () => ui.stack.find(p => p.view === 'meal-form');

function push(p) { ui.stack.push(p); render(); window.scrollTo(0, 0); }
function pop() { ui.stack.pop(); render(); }
function popAll() { ui.stack = []; render(); }
function backToDraft() {
  while (page() && page().view !== 'meal-form') ui.stack.pop();
  render();
}

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.hidden = true; }, 1800);
}
// "Added to Dinner", plus the date when it isn't today.
const addedMsg = (what, meal) => `${what} ${L.MEAL_LABELS[meal]}${ui.date === today() ? '' : ` · ${shortDate(ui.date)}`}`;

function selectDate(date) {
  ui.date = date;
  if (date === today()) ui.mealTab = L.mealForTime(now());
}

// ---------- Render ----------
const PAGES = { pick: renderPick, log: renderLog, quick: renderQuick, 'food-form': renderFoodForm, 'meal-form': renderMealForm, repeat: renderRepeat };
const TABS = { today: renderToday, foods: renderFoods, meals: renderMeals, settings: renderSettings };

function render() {
  const p = page();
  if (p) {
    $app.innerHTML = PAGES[p.view](p);
    if (p.view === 'pick') fillPickList(p);
    return;
  }
  $app.innerHTML = TABS[ui.tab]() + tabbar();
  if (ui.tab === 'foods') fillFoodsList();
  ui.slide = '';
}

const ICONS = {
  today: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>',
  foods: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="3.5" cy="6" r="1" fill="currentColor"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/><circle cx="3.5" cy="18" r="1" fill="currentColor"/></svg>',
  meals: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/></svg>',
  settings: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
};

function tabbar() {
  const t = (id, label) => `<button class="tb${ui.tab === id ? ' on' : ''}" data-act="tab" data-tab="${id}">${ICONS[id]}${label}</button>`;
  return `<nav class="tabbar">${t('today', 'Today')}${t('foods', 'Foods')}${t('meals', 'Meals')}${t('settings', 'Settings')}</nav>`;
}

function dayTitle(date) {
  const t = today();
  if (date === t) return 'Today';
  if (date === L.addDays(t, -1)) return 'Yesterday';
  if (date === L.addDays(t, 1)) return 'Tomorrow';
  return L.fromISODate(date).toLocaleDateString('en-US', { weekday: 'long' });
}

function dateLine(date) {
  const d = L.fromISODate(date);
  if (['Today', 'Yesterday', 'Tomorrow'].includes(dayTitle(date))) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function entryDetail(e) {
  if (e.kind === 'quick') return 'Quick add';
  if (e.unit === 'grams') return `${fmt(e.amount)} g`;
  const grams = Math.round(e.amount * e.snapshot.servingGrams);
  return `${plural(e.amount, 'serving')} · ${fmt(grams)} g`;
}

const avatar = e => `<div class="av${e.kind === 'quick' ? ' quick' : ''}">${e.kind === 'quick' ? '+' : esc(e.name.charAt(0).toUpperCase())}</div>`;

// Week strip: Mon–Sun, a progress ring per day (blue, red when over the calorie goal).
function weekStrip() {
  const start = L.weekStartOf(ui.date);
  const t = today();
  const goal = S.getGoals().calGoal;
  const R = 17, C = 2 * Math.PI * R;
  const days = L.weekDates(start).map(date => {
    const eaten = L.totals(S.entriesFor(date)).cal;
    const p = L.progress(eaten, goal);
    const sel = date === ui.date;
    const ring = eaten > 0 ? `<circle cx="20" cy="20" r="${R}" fill="none" stroke="${p.over ? 'var(--red)' : 'var(--blue)'}" stroke-width="3"
      stroke-linecap="round" stroke-dasharray="${(p.pct * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 20 20)"/>` : '';
    const d = L.fromISODate(date);
    return `<button class="d${sel ? ' sel' : ''}${date === t ? ' today' : ''}${p.over ? ' over' : ''}" data-act="pick-day" data-date="${date}" aria-label="${dateLine(date)}">
      <div class="dow">${d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</div>
      <div class="ring"><svg viewBox="0 0 40 40">${sel ? '<circle cx="20" cy="20" r="13.5" class="selbg"/>' : ''}
        <circle cx="20" cy="20" r="${R}" fill="none" stroke="#ececf0" stroke-width="3"/>${ring}</svg>
        <div class="n">${d.getDate()}</div></div></button>`;
  }).join('');
  return `<div class="week" data-swipe="week">
    <button class="arrow" data-act="week" data-dir="-1" aria-label="Previous week">‹</button>
    <div class="days ${ui.slide}">${days}</div>
    <button class="arrow" data-act="week" data-dir="1" aria-label="Next week">›</button></div>`;
}

function renderToday() {
  const entries = S.entriesFor(ui.date);
  const day = L.totals(entries);
  const meal = ui.mealTab;
  const list = entries.filter(e => e.meal === meal);
  const sub = L.totals(list);

  const tabs = L.MEALS.map(m => {
    const t = L.totals(entries.filter(e => e.meal === m));
    return `<button class="tab${m === meal ? ' on' : ''}" data-act="meal-tab" data-meal="${m}">
      <div class="t">${L.MEAL_LABELS[m]}</div><div class="s num">${fmt(t.cal)}</div></button>`;
  }).join('');

  const rows = list.length ? list.map(e => `
    <button class="entry" data-act="edit-entry" data-id="${e.id}">
      ${avatar(e)}
      <div class="mid"><div class="n">${esc(e.name)}</div><div class="q">${entryDetail(e)}</div></div>
      <div class="v num"><div class="c">${fmt(e.cal)}</div><div class="p">${fmt(e.protein)} g</div></div>
    </button>`).join('')
    : `<div class="empty">Nothing logged for ${L.MEAL_LABELS[meal]} yet.</div>`;

  return `<main class="screen with-tabs">
    <div class="top"><div><div class="date">${dateLine(ui.date)}</div><div class="title">${dayTitle(ui.date)}</div></div>
      ${ui.date === today() ? '' : '<button class="today-pill" data-act="go-today">Today</button>'}</div>
    ${weekStrip()}
    ${hero(day)}
    <div class="tabs">${tabs}</div>
    <div class="list">
      ${rows}
      <div class="subtotal"><span>${L.MEAL_LABELS[meal]} total</span><span class="num"><span class="c">${fmt(sub.cal)} cal</span> · <span class="p">${fmt(sub.protein)} g</span></span></div>
      <div class="addrow">
        <button class="btn primary" data-act="open-pick">+ Add food</button>
        <button class="btn" data-act="open-quick">Quick add</button>
        <button class="btn" data-act="open-repeat">Repeat</button>
      </div>
      ${list.length ? `<button class="link" data-act="save-as-meal">Save ${L.MEAL_LABELS[meal]} as a meal</button>` : ''}
    </div>
  </main>`;
}

// Big calories-remaining number + calorie (blue) and protein (orange) bars.
// Calories turn red only once eaten is over the goal.
function hero(day) {
  const goals = S.getGoals();
  const cal = L.progress(day.cal, goals.calGoal);
  const pro = L.progress(day.protein, goals.proteinGoal);
  const big = L.formatSigned(cal.remaining);
  const size = big.length > 6 ? ' xs' : big.length > 4 ? ' sm' : '';
  return `<section class="hero${cal.over ? ' over' : ''}">
    <div>
      <div class="big num${size}" data-testid="remaining">${big}</div>
      <div class="cap">cal remaining</div>
    </div>
    <div class="bars">
      <div class="bar cal"><div class="lbl">Calories</div>
        <div class="val num" data-testid="cal-val">${fmt(cal.eaten)} <small>/ ${fmt(cal.goal)} cal</small></div>
        <div class="track"><div class="fill" style="width:${(cal.pct * 100).toFixed(1)}%"></div></div></div>
      <div class="bar pro"><div class="lbl">Protein</div>
        <div class="val num" data-testid="pro-val">${fmt(pro.eaten)} <small>/ ${fmt(pro.goal)} g</small></div>
        <div class="track"><div class="fill" style="width:${(pro.pct * 100).toFixed(1)}%"></div></div></div>
    </div>
  </section>`;
}

const searchBox = (id, value = '', placeholder = 'Search saved foods') => `<div class="search">
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  <input id="${id}" type="search" placeholder="${placeholder}" value="${esc(value)}" autocomplete="off" autocorrect="off" spellcheck="false"></div>`;

function renderFoods() {
  return `<main class="screen with-tabs">
    <div class="pagetitle">Foods</div>
    <div class="rowlinks"><button class="btn primary" data-act="new-food">+ New food</button></div>
    ${searchBox('foods-search', ui.foodsQuery || '')}
    <div class="list" id="foods-list"></div>
  </main>`;
}

const foodRows = (foods, act) => foods.map(f => `
  <button class="food" data-act="${act}" data-id="${f.id}">
    <div><div class="n">${esc(f.name)}</div><div class="q">per ${fmt(f.servingGrams)} g serving</div></div>
    <div class="v num"><span class="c">${fmt(f.cal)} cal</span> · <span class="p">${fmt(f.protein)} g</span></div>
  </button>`).join('');

const noFoods = all => `<div class="empty">${all.length ? 'No foods match your search.' : 'No saved foods yet. Tap <b>+ New food</b> to add one.'}</div>`;

// Lists are filled separately so the search box keeps focus while typing.
function fillFoodsList() {
  const all = S.getState().foods;
  const foods = L.searchFoods(all, document.getElementById('foods-search').value);
  document.getElementById('foods-list').innerHTML = foods.length ? foodRows(foods, 'edit-food') : noFoods(all);
}

function fillPickList(p) {
  const q = document.getElementById('pick-search').value;
  const all = S.getState().foods;
  const foods = L.searchFoods(all, q);
  let html = '';
  if (!p.toDraft) {
    const meals = L.searchFoods(S.getState().savedMeals, q);
    if (meals.length) html += `<div class="list-h">Saved meals</div>${meals.map(m => savedMealRow(m)).join('')}<div class="list-h">Foods</div>`;
  }
  html += foods.length ? foodRows(foods, 'pick-food') : noFoods(all);
  document.getElementById('pick-list').innerHTML = html;
}

function savedMealRow(m, { editable = false } = {}) {
  const t = L.totals(S.mealItemsForAdding(m).map(L.entryFieldsFromItem));
  return `<div class="mealrow">
    <button class="mid" data-act="${editable ? 'edit-meal' : 'add-meal'}" data-id="${m.id}">
      <div class="n">${esc(m.name)}</div>
      <div class="q num">${plural(m.items.length, 'item')} · <span class="c">${fmt(t.cal)} cal</span> · <span class="p">${fmt(t.protein)} g</span></div>
    </button>
    <button class="addbtn" data-act="add-meal" data-id="${m.id}">+ Add</button>
  </div>`;
}

function renderMeals() {
  const meals = S.getState().savedMeals;
  const groups = L.MEALS.map(cat => {
    const list = L.searchFoods(meals.filter(m => m.category === cat), '');
    return list.length ? `<div class="section-h">${L.MEAL_LABELS[cat]}</div><div class="list">${list.map(m => savedMealRow(m, { editable: true })).join('')}</div>` : '';
  }).join('');
  return `<main class="screen with-tabs"><div class="pagetitle">Meals</div>
    <div class="rowlinks"><button class="btn primary" data-act="new-meal">+ New meal</button></div>
    ${groups || `<div class="placeholder">No saved meals yet.<br>Build one with <b>+ New meal</b>, or open a meal on the Today tab and tap <b>Save … as a meal</b>.</div>`}
    ${meals.length ? `<p class="note">“+ Add” puts the meal on ${ui.date === today() ? 'today' : shortDate(ui.date)}, in the meal for the current time.</p>` : ''}
  </main>`;
}

function renderSettings() {
  const g = S.getGoals();
  return `<main class="screen with-tabs"><div class="pagetitle">Settings</div>
    <div class="section-h">Daily goals</div>
    <div class="form">
      <div class="row2">
        <div class="field"><label for="g-cal" class="c">Calories</label><div class="unit"><input id="g-cal" inputmode="numeric" pattern="[0-9]*" value="${g.calGoal}"><span>cal</span></div></div>
        <div class="field"><label for="g-pro" class="p">Protein</label><div class="unit"><input id="g-pro" inputmode="numeric" pattern="[0-9]*" value="${g.proteinGoal}"><span>g</span></div></div>
      </div>
      <div class="err" id="g-err"></div>
    </div>
    <div class="actions"><button class="btn primary big" data-act="save-goals">Save goals</button></div>
    <p class="note">The same goals apply to every day.</p>
    <div class="section-h">Backup</div>
    <p class="note left">Export / Import is coming in Phase 4.</p>
  </main>`;
}

function nav(title, back = 'Back') {
  return `<div class="nav"><button class="back" data-act="back">‹ ${back}</button><div class="ttl">${title}</div><span></span></div>`;
}

function renderPick(p) {
  return `<main class="screen page">
    ${nav(p.toDraft ? 'Add to meal' : 'Add food', p.toDraft ? 'Meal' : 'Today')}
    <div class="rowlinks">
      <button class="btn" data-act="new-food-then-log">+ New food</button>
      <button class="btn" data-act="open-quick">${p.toDraft ? 'Quick item' : 'Quick add'}</button>
    </div>
    ${searchBox('pick-search', '', p.toDraft ? 'Search saved foods' : 'Search foods and meals')}
    <div class="list" id="pick-list"></div>
  </main>`;
}

const mealSelector = (selected, act = 'pick-meal') => `<div class="mealsel">${L.MEALS.map(m =>
  `<button class="${m === selected ? 'on' : ''}" data-act="${act}" data-meal="${m}">${L.MEAL_LABELS[m]}</button>`).join('')}</div>`;

// Keypad page. Logs a saved food, edits a logged entry, or adds/edits an item in a saved meal draft.
function renderLog(p) {
  const amount = parseFloat(p.amountStr) || 0;
  const r = L.scale(p.snap, p.unit, amount);
  const unitLabel = p.unit === 'grams' ? 'grams' : (amount === 1 ? 'serving' : 'servings');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  const editing = p.entryId || p.itemIndex != null;
  const cta = editing ? 'Save changes' : p.toDraft ? 'Add to meal' : `Add to ${L.MEAL_LABELS[p.meal]}`;
  const title = p.toDraft ? (editing ? 'Edit item' : 'Add item') : (editing ? 'Edit entry' : 'Log food');
  return `<main class="screen page">
    ${nav(title)}
    <div class="food-card"><div class="n">${esc(p.name)}</div>
      <div class="q num">Serving ${fmt(p.snap.servingGrams)} g · ${fmt(p.snap.cal)} cal · ${fmt(p.snap.protein)} g protein</div></div>
    <div class="chips">
      <button class="chip${p.unit === 'servings' ? ' on' : ''}" data-act="unit" data-unit="servings">Servings</button>
      <button class="chip${p.unit === 'grams' ? ' on' : ''}" data-act="unit" data-unit="grams">Grams</button>
    </div>
    <div class="amt"><div class="big num" data-testid="amount">${esc(p.amountStr)}</div><div class="u">${unitLabel}</div></div>
    <div class="res num"><div class="rc"><b>${fmt(r.cal)}</b><span>CALORIES</span></div><div class="rp"><b>${fmt(r.protein)} g</b><span>PROTEIN</span></div></div>
    ${p.toDraft ? '' : mealSelector(p.meal)}
    <div class="pad">${keys.map(k => `<button data-act="key" data-key="${k}">${k}</button>`).join('')}</div>
    <div class="actions">
      <button class="btn primary big" data-act="save-log" ${amount > 0 ? '' : 'disabled'}>${cta}</button>
      ${editing ? `<button class="btn danger big" data-act="delete-entry">${p.toDraft ? 'Remove item' : 'Delete entry'}</button>` : ''}
    </div>
  </main>`;
}

function renderQuick(p) {
  const src = p.entryId ? S.getEntry(p.entryId) : p.itemIndex != null ? draftPage().draft.items[p.itemIndex] : null;
  const val = k => (src ? esc(k === 'label' ? (src.name === 'Quick add' ? '' : src.name) : src[k]) : '');
  const title = p.toDraft ? (src ? 'Edit quick item' : 'Quick item') : (src ? 'Edit quick add' : 'Quick add');
  const cta = src ? 'Save changes' : p.toDraft ? 'Add to meal' : `Add to <span id="q-meal">${L.MEAL_LABELS[p.meal]}</span>`;
  return `<main class="screen page">
    ${nav(title)}
    <div class="form">
      <div class="field"><label for="q-label">Label (optional)</label><input id="q-label" placeholder="e.g. Coffee with milk" value="${val('label')}" autocomplete="off"></div>
      <div class="row2">
        <div class="field"><label for="q-cal" class="c">Calories</label><div class="unit"><input id="q-cal" inputmode="numeric" pattern="[0-9]*" value="${val('cal')}"><span>cal</span></div></div>
        <div class="field"><label for="q-pro" class="p">Protein</label><div class="unit"><input id="q-pro" inputmode="numeric" pattern="[0-9]*" value="${val('protein')}"><span>g</span></div></div>
      </div>
    </div>
    ${p.toDraft ? '' : mealSelector(p.meal)}
    <div class="err" id="q-err" style="margin:10px 20px 0"></div>
    <div class="actions">
      <button class="btn primary big" data-act="save-quick">${cta}</button>
      ${src ? `<button class="btn danger big" data-act="delete-entry">${p.toDraft ? 'Remove item' : 'Delete entry'}</button>` : ''}
    </div>
  </main>`;
}

function renderFoodForm(p) {
  const f = p.foodId ? S.getFood(p.foodId) : null;
  const v = k => (f ? esc(f[k]) : '');
  return `<main class="screen page">
    ${nav(f ? 'Edit food' : 'New food')}
    <div class="form">
      <div class="field"><label for="f-name">Name</label><input id="f-name" placeholder="e.g. Chicken breast" value="${v('name')}" autocomplete="off"></div>
      <div class="field"><label for="f-grams">Serving size</label><div class="unit"><input id="f-grams" inputmode="decimal" value="${v('servingGrams')}" placeholder="100"><span>g</span></div></div>
      <div class="row2">
        <div class="field"><label for="f-cal" class="c">Calories / serving</label><div class="unit"><input id="f-cal" inputmode="numeric" pattern="[0-9]*" value="${v('cal')}"><span>cal</span></div></div>
        <div class="field"><label for="f-pro" class="p">Protein / serving</label><div class="unit"><input id="f-pro" inputmode="decimal" value="${v('protein')}"><span>g</span></div></div>
      </div>
      <div class="err" id="f-err"></div>
    </div>
    <div class="actions">
      <button class="btn primary big" data-act="save-food">${f ? 'Save food' : 'Create food'}</button>
      ${f ? '<button class="btn danger big" data-act="delete-food">Delete food</button>' : ''}
    </div>
    ${f ? '<p class="note">Changes here won’t affect anything you’ve already logged.</p>' : ''}
  </main>`;
}

// Saved meal builder / editor. The draft lives on this page until saved.
function renderMealForm(p) {
  const d = p.draft;
  const t = L.totals(d.items.map(L.entryFieldsFromItem));
  const items = d.items.length ? d.items.map((it, i) => {
    const e = L.entryFieldsFromItem(it);
    return `<div class="entry">
      <button class="entry-main" data-act="edit-item" data-i="${i}">${avatar(it)}
        <div class="mid"><div class="n">${esc(it.name)}</div><div class="q">${entryDetail({ ...it, ...e })}</div></div>
        <div class="v num"><div class="c">${fmt(e.cal)}</div><div class="p">${fmt(e.protein)} g</div></div></button>
      <button class="remove" data-act="remove-item" data-i="${i}" aria-label="Remove ${esc(it.name)}">×</button>
    </div>`;
  }).join('') : '<div class="empty">No items yet. Add foods or a quick item.</div>';
  return `<main class="screen page">
    ${nav(d.id ? 'Edit meal' : 'New meal')}
    <div class="form"><div class="field"><label for="m-name">Meal name</label>
      <input id="m-name" placeholder="e.g. Usual breakfast" value="${esc(d.name)}" autocomplete="off"></div></div>
    <div class="section-h">Category</div>
    ${mealSelector(d.category, 'pick-cat')}
    <div class="section-h">Items</div>
    <div class="list">${items}
      <div class="subtotal"><span>Total</span><span class="num"><span class="c">${fmt(t.cal)} cal</span> · <span class="p">${fmt(t.protein)} g</span></span></div>
      <div class="addrow"><button class="btn" data-act="draft-add-food">+ Add food</button><button class="btn" data-act="draft-add-quick">+ Quick item</button></div>
    </div>
    <div class="err" id="m-err" style="margin:10px 20px 0"></div>
    <div class="actions">
      <button class="btn primary big" data-act="save-meal">Save meal</button>
      ${d.id ? '<button class="btn danger big" data-act="delete-meal">Delete meal</button>' : ''}
    </div>
  </main>`;
}

// Repeat: pick a meal from an earlier day and copy it into the selected day.
function renderRepeat(p) {
  const blocks = [];
  for (let i = 1; i <= p.days; i++) {
    const date = L.addDays(ui.date, -i);
    const entries = S.entriesFor(date);
    const rows = L.MEALS.map(m => {
      const list = entries.filter(e => e.meal === m);
      if (!list.length) return '';
      const t = L.totals(list);
      return `<button class="food" data-act="repeat-meal" data-date="${date}" data-meal="${m}">
        <div class="mid"><div class="n">${L.MEAL_LABELS[m]}</div><div class="q">${esc(list.map(e => e.name).join(', '))}</div></div>
        <div class="v num"><span class="c">${fmt(t.cal)} cal</span> · <span class="p">${fmt(t.protein)} g</span></div></button>`;
    }).join('');
    if (rows) blocks.push(`<div class="list-h">${dayTitle(date) === 'Yesterday' ? 'Yesterday' : shortDate(date)}</div>${rows}`);
  }
  return `<main class="screen page">
    ${nav('Repeat a meal', 'Today')}
    <p class="note left" style="margin-top:4px">Copies into ${ui.date === today() ? 'today' : shortDate(ui.date)}, in the meal for the current time (${L.MEAL_LABELS[L.mealForTime(now())]}). You can edit or move items afterward.</p>
    <div class="list">${blocks.join('') || `<div class="empty">Nothing logged in the ${p.days} days before ${shortDate(ui.date)}.</div>`}</div>
    <div class="actions"><button class="btn" data-act="repeat-more">Show older days</button></div>
  </main>`;
}

// ---------- Page openers ----------
function openLogNew(food, toDraft) {
  push({ view: 'log', toDraft, foodId: food.id, name: food.name, snap: { servingGrams: food.servingGrams, cal: food.cal, protein: food.protein },
    unit: 'servings', amountStr: '1', fresh: true, meal: L.mealForTime(now()) });
}

function openEditEntry(e) {
  if (e.kind === 'quick') return push({ view: 'quick', entryId: e.id, meal: e.meal });
  push({ view: 'log', entryId: e.id, name: e.name, snap: e.snapshot, unit: e.unit, amountStr: String(e.amount), fresh: true, meal: e.meal });
}

function openEditItem(i) {
  const it = draftPage().draft.items[i];
  if (it.kind === 'quick') return push({ view: 'quick', toDraft: true, itemIndex: i });
  push({ view: 'log', toDraft: true, itemIndex: i, foodId: it.foodId, name: it.name, snap: it.snapshot, unit: it.unit, amountStr: String(it.amount), fresh: true });
}

function itemFromEntry(e) {
  return e.kind === 'quick'
    ? { kind: 'quick', name: e.name, cal: e.cal, protein: e.protein }
    : { kind: 'food', foodId: e.foodId, name: e.name, unit: e.unit, amount: e.amount, snapshot: { ...e.snapshot } };
}

// Put an item into the meal draft (new or replacing one), then return to the builder.
function saveDraftItem(p, item) {
  const items = draftPage().draft.items;
  if (p.itemIndex != null) items[p.itemIndex] = item; else items.push(item);
  backToDraft();
}

function pressKey(p, k) {
  let s = p.fresh ? '' : p.amountStr;
  p.fresh = false;
  if (k === '⌫') s = s.slice(0, -1);
  else if (k === '.') { if (!s.includes('.')) s = (s || '0') + '.'; }
  else if (s === '0') s = k;
  else if (s.length < 6) s += k;
  p.amountStr = s || '0';
}

const num = id => {
  const raw = document.getElementById(id).value.trim();
  return raw === '' ? NaN : Number(raw);
};

function finishAdd(meal, msg) {
  ui.tab = 'today'; ui.mealTab = meal; popAll();
  toast(msg);
}

// ---------- Events ----------
let suppressClick = false;

$app.addEventListener('click', ev => {
  if (suppressClick) { suppressClick = false; return; }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const p = page();
  const { act } = el.dataset;

  switch (act) {
    case 'tab': ui.tab = el.dataset.tab; popAll(); window.scrollTo(0, 0); break;
    case 'meal-tab': ui.mealTab = el.dataset.meal; render(); break;
    case 'back': pop(); break;

    // Week strip
    case 'pick-day': selectDate(el.dataset.date); render(); break;
    case 'week': changeWeek(Number(el.dataset.dir)); break;
    case 'go-today': selectDate(today()); render(); break;

    case 'open-pick': push({ view: 'pick' }); break;
    case 'open-quick': push({ view: 'quick', toDraft: p?.toDraft, meal: L.mealForTime(now()) }); break;
    case 'open-repeat': push({ view: 'repeat', days: 14 }); break;
    case 'repeat-more': p.days += 14; render(); break;
    case 'new-food': push({ view: 'food-form' }); break;
    case 'new-food-then-log': push({ view: 'food-form', thenLog: true, toDraft: p.toDraft }); break;
    case 'edit-food': push({ view: 'food-form', foodId: el.dataset.id }); break;
    case 'pick-food': openLogNew(S.getFood(el.dataset.id), p.toDraft); break;
    case 'edit-entry': openEditEntry(S.getEntry(el.dataset.id)); break;

    case 'pick-meal':
      p.meal = el.dataset.meal;
      if (p.view === 'quick') { // don't re-render: keep what's been typed
        document.querySelectorAll('.mealsel button').forEach(b => b.classList.toggle('on', b === el));
        const label = document.getElementById('q-meal');
        if (label) label.textContent = L.MEAL_LABELS[p.meal];
      } else render();
      break;

    case 'unit': {
      const to = el.dataset.unit;
      if (to === p.unit) break;
      const amt = L.convertAmount(p.snap, p.unit, to, parseFloat(p.amountStr) || 0);
      p.unit = to; p.amountStr = String(amt); p.fresh = true;
      render();
      break;
    }
    case 'key': pressKey(p, el.dataset.key); render(); break;

    case 'save-log': {
      const amount = parseFloat(p.amountStr);
      if (!(amount > 0)) break;
      if (p.toDraft) {
        saveDraftItem(p, { kind: 'food', foodId: p.foodId, name: p.name, unit: p.unit, amount, snapshot: { ...p.snap } });
      } else if (p.entryId) {
        S.updateEntry(p.entryId, { unit: p.unit, amount, meal: p.meal });
        finishAdd(p.meal, 'Saved');
      } else {
        S.logFood(S.getFood(p.foodId), { date: ui.date, meal: p.meal, unit: p.unit, amount });
        finishAdd(p.meal, addedMsg('Added to', p.meal));
      }
      break;
    }
    case 'save-quick': {
      const cal = num('q-cal');
      const protein = num('q-pro');
      const err = document.getElementById('q-err');
      if (!(cal >= 0)) { err.textContent = 'Enter calories.'; break; }
      if (protein < 0) { err.textContent = 'Protein must be 0 or more.'; break; } // blank = 0
      const label = document.getElementById('q-label').value.trim();
      const data = { cal: Math.round(cal), protein: Math.round(protein || 0) };
      if (p.toDraft) {
        saveDraftItem(p, { kind: 'quick', name: label || 'Quick add', ...data });
      } else if (p.entryId) {
        S.updateEntry(p.entryId, { name: label || 'Quick add', ...data, meal: p.meal });
        finishAdd(p.meal, 'Saved');
      } else {
        S.quickAdd({ label, ...data, meal: p.meal, date: ui.date });
        finishAdd(p.meal, addedMsg('Added to', p.meal));
      }
      break;
    }
    case 'delete-entry':
      if (p.toDraft) { draftPage().draft.items.splice(p.itemIndex, 1); backToDraft(); break; }
      if (confirm('Delete this entry?')) { S.deleteEntry(p.entryId); popAll(); toast('Deleted'); }
      break;

    case 'save-food': {
      const name = document.getElementById('f-name').value.trim();
      const servingGrams = num('f-grams');
      const cal = num('f-cal');
      const protein = num('f-pro');
      const err = document.getElementById('f-err');
      if (!name) { err.textContent = 'Enter a name.'; break; }
      if (!(servingGrams > 0)) { err.textContent = 'Serving size must be more than 0 g.'; break; }
      if (!(cal >= 0)) { err.textContent = 'Enter calories per serving.'; break; }
      if (!(protein >= 0)) { err.textContent = 'Enter protein per serving (0 is fine).'; break; }
      const food = S.saveFood({ id: p.foodId, name, servingGrams, cal, protein });
      if (p.thenLog) { ui.stack.pop(); openLogNew(food, p.toDraft); } else { pop(); toast(p.foodId ? 'Food saved' : 'Food created'); }
      break;
    }
    case 'delete-food':
      if (confirm('Delete this saved food? Entries you already logged stay as they are.')) {
        S.deleteFood(p.foodId); pop(); toast('Food deleted');
      }
      break;

    case 'save-goals': {
      const calGoal = num('g-cal');
      const proteinGoal = num('g-pro');
      const err = document.getElementById('g-err');
      if (!(calGoal > 0)) { err.textContent = 'Enter a calorie goal above 0.'; break; }
      if (!(proteinGoal > 0)) { err.textContent = 'Enter a protein goal above 0.'; break; }
      S.saveGoals({ calGoal: Math.round(calGoal), proteinGoal: Math.round(proteinGoal) });
      err.textContent = '';
      toast('Goals saved');
      break;
    }

    // Saved meals
    case 'new-meal': push({ view: 'meal-form', draft: { name: '', category: L.mealForTime(now()), items: [] } }); break;
    case 'save-as-meal': {
      const items = S.entriesFor(ui.date).filter(e => e.meal === ui.mealTab).map(itemFromEntry);
      push({ view: 'meal-form', draft: { name: '', category: ui.mealTab, items } });
      break;
    }
    case 'edit-meal': {
      const m = S.getMeal(el.dataset.id);
      push({ view: 'meal-form', draft: structuredClone(m) });
      break;
    }
    case 'pick-cat': p.draft.category = el.dataset.meal; render(); break;
    case 'draft-add-food': push({ view: 'pick', toDraft: true }); break;
    case 'draft-add-quick': push({ view: 'quick', toDraft: true }); break;
    case 'edit-item': openEditItem(Number(el.dataset.i)); break;
    case 'remove-item': p.draft.items.splice(Number(el.dataset.i), 1); render(); break;
    case 'save-meal': {
      const d = p.draft;
      const err = document.getElementById('m-err');
      if (!d.name.trim()) { err.textContent = 'Give the meal a name.'; break; }
      if (!d.items.length) { err.textContent = 'Add at least one item.'; break; }
      S.saveMeal(d);
      ui.tab = 'meals'; popAll();
      toast(d.id ? 'Meal saved' : `Saved “${d.name.trim()}”`);
      break;
    }
    case 'delete-meal':
      if (confirm('Delete this saved meal? Anything already logged stays.')) {
        S.deleteMeal(p.draft.id); popAll(); toast('Meal deleted');
      }
      break;
    case 'add-meal': {
      // One tap: goes into the meal for the current clock time, on the selected day.
      const m = S.getMeal(el.dataset.id);
      const meal = L.mealForTime(now());
      S.addEntries(S.mealItemsForAdding(m), { date: ui.date, meal });
      finishAdd(meal, addedMsg(`Added ${m.name} to`, meal));
      break;
    }
    case 'repeat-meal': {
      const { date, meal: from } = el.dataset;
      const meal = L.mealForTime(now());
      S.addEntries(S.entriesFor(date).filter(e => e.meal === from).map(itemFromEntry), { date: ui.date, meal });
      finishAdd(meal, addedMsg(`Copied ${shortDate(date)} ${L.MEAL_LABELS[from]} to`, meal));
      break;
    }
  }
});

$app.addEventListener('input', ev => {
  const p = page();
  if (ev.target.id === 'pick-search') fillPickList(p);
  if (ev.target.id === 'foods-search') { ui.foodsQuery = ev.target.value; fillFoodsList(); }
  if (ev.target.id === 'm-name') p.draft.name = ev.target.value;
});

// ---------- Week navigation: arrows or swipe ----------
function changeWeek(dir) {
  selectDate(L.addDays(ui.date, 7 * dir)); // same weekday in the next/previous week
  ui.slide = dir > 0 ? 'from-right' : 'from-left';
  render();
}

let swipe = null;
$app.addEventListener('pointerdown', ev => {
  suppressClick = false; // a new touch starts fresh
  if (ev.target.closest('[data-swipe="week"]')) swipe = { x: ev.clientX, y: ev.clientY };
});
$app.addEventListener('pointerup', ev => {
  if (!swipe) return;
  const dx = ev.clientX - swipe.x, dy = ev.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    suppressClick = true; // the swipe shouldn't also tap a day
    changeWeek(dx < 0 ? 1 : -1);
  }
});
$app.addEventListener('pointercancel', () => { swipe = null; });

// If the app was left open across 4:01 AM, roll "Today" forward when it comes back.
let shownToday = ui.date;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = today();
  if (t !== shownToday && ui.date === shownToday && !page()) { selectDate(t); render(); }
  shownToday = t;
});

render();
