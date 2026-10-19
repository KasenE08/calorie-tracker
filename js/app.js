import * as L from './logic.js';
import * as S from './store.js';

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
const now = () => new Date();
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// UI state. `stack` holds pages opened on top of the current bottom tab.
const ui = {
  tab: 'today',
  date: L.appDateFor(now()),
  mealTab: L.mealForTime(now()),
  stack: [],
};
const page = () => ui.stack[ui.stack.length - 1];

function push(p) { ui.stack.push(p); render(); window.scrollTo(0, 0); }
function pop() { ui.stack.pop(); render(); }
function popAll() { ui.stack = []; render(); }

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.hidden = true; }, 1600);
}

// ---------- Render ----------
function render() {
  const p = page();
  if (p) {
    $app.innerHTML = { pick: renderPick, log: renderLog, quick: renderQuick, 'food-form': renderFoodForm }[p.view](p);
    if (p.view === 'pick') fillFoodList('pick');
    return;
  }
  $app.innerHTML = { today: renderToday, foods: renderFoods, meals: renderMeals, settings: renderSettings }[ui.tab]() + tabbar();
  if (ui.tab === 'foods') fillFoodList('foods');
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
  const today = L.appDateFor(now());
  const d = L.fromISODate(date);
  if (date === today) return 'Today';
  if (date === L.addDays(today, -1)) return 'Yesterday';
  if (date === L.addDays(today, 1)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function entryDetail(e) {
  if (e.kind === 'quick') return 'Quick add';
  if (e.unit === 'grams') return `${fmt(e.amount)} g`;
  const grams = Math.round(e.amount * e.snapshot.servingGrams);
  return `${plural(e.amount, 'serving')} · ${fmt(grams)} g`;
}

function renderToday() {
  const entries = S.entriesFor(ui.date);
  const day = L.totals(entries);
  const dateLine = L.fromISODate(ui.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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
      <div class="av${e.kind === 'quick' ? ' quick' : ''}">${e.kind === 'quick' ? '+' : esc(e.name.charAt(0).toUpperCase())}</div>
      <div class="mid"><div class="n">${esc(e.name)}</div><div class="q">${entryDetail(e)}</div></div>
      <div class="v num"><div class="c">${fmt(e.cal)}</div><div class="p">${fmt(e.protein)} g</div></div>
    </button>`).join('')
    : `<div class="empty">Nothing logged for ${L.MEAL_LABELS[meal]} yet.</div>`;

  return `<main class="screen with-tabs">
    <div class="top"><div><div class="date">${dateLine}</div><div class="title">${dayTitle(ui.date)}</div></div></div>
    ${hero(day)}
    <div class="tabs">${tabs}</div>
    <div class="list">
      ${rows}
      <div class="subtotal"><span>${L.MEAL_LABELS[meal]} total</span><span class="num"><span class="c">${fmt(sub.cal)} cal</span> · <span class="p">${fmt(sub.protein)} g</span></span></div>
      <div class="addrow">
        <button class="btn primary" data-act="open-pick">+ Add food</button>
        <button class="btn" data-act="open-quick">Quick add</button>
      </div>
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

const searchBox = (id, value = '') => `<div class="search">
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  <input id="${id}" type="search" placeholder="Search saved foods" value="${esc(value)}" autocomplete="off" autocorrect="off" spellcheck="false"></div>`;

function renderFoods() {
  return `<main class="screen with-tabs">
    <div class="pagetitle">Foods</div>
    <div class="rowlinks"><button class="btn primary" data-act="new-food">+ New food</button></div>
    ${searchBox('foods-search', ui.foodsQuery || '')}
    <div class="list" id="foods-list"></div>
  </main>`;
}

// Fills the food list without re-rendering the page, so the search box keeps focus.
function fillFoodList(where) {
  const input = document.getElementById(`${where}-search`);
  const box = document.getElementById(`${where}-list`);
  const all = S.getState().foods;
  const foods = L.searchFoods(all, input.value);
  const act = where === 'pick' ? 'pick-food' : 'edit-food';
  box.innerHTML = foods.length ? foods.map(f => `
    <button class="food" data-act="${act}" data-id="${f.id}">
      <div><div class="n">${esc(f.name)}</div><div class="q">per ${fmt(f.servingGrams)} g serving</div></div>
      <div class="v num"><span class="c">${fmt(f.cal)} cal</span> · <span class="p">${fmt(f.protein)} g</span></div>
    </button>`).join('')
    : `<div class="empty">${all.length ? 'No foods match your search.' : 'No saved foods yet. Tap <b>+ New food</b> to add one.'}</div>`;
}

function renderMeals() {
  return `<main class="screen with-tabs"><div class="pagetitle">Meals</div>
    <div class="placeholder">Saved meals and “Repeat a meal” are coming in Phase 3.</div></main>`;
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

function renderPick() {
  return `<main class="screen page">
    ${nav('Add food', 'Today')}
    <div class="rowlinks">
      <button class="btn" data-act="new-food-then-log">+ New food</button>
      <button class="btn" data-act="open-quick">Quick add</button>
    </div>
    ${searchBox('pick-search')}
    <div class="list" id="pick-list"></div>
  </main>`;
}

const mealSelector = selected => `<div class="mealsel">${L.MEALS.map(m =>
  `<button class="${m === selected ? 'on' : ''}" data-act="pick-meal" data-meal="${m}">${L.MEAL_LABELS[m]}</button>`).join('')}</div>`;

// Log a saved food, or edit a logged food entry. Amount is typed on the keypad.
function renderLog(p) {
  const amount = parseFloat(p.amountStr) || 0;
  const r = L.scale(p.snap, p.unit, amount);
  const unitLabel = p.unit === 'grams' ? 'grams' : (amount === 1 ? 'serving' : 'servings');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  const cta = p.entryId ? 'Save changes' : `Add to ${L.MEAL_LABELS[p.meal]}`;
  return `<main class="screen page">
    ${nav(p.entryId ? 'Edit entry' : 'Log food')}
    <div class="food-card"><div class="n">${esc(p.name)}</div>
      <div class="q num">Serving ${fmt(p.snap.servingGrams)} g · ${fmt(p.snap.cal)} cal · ${fmt(p.snap.protein)} g protein</div></div>
    <div class="chips">
      <button class="chip${p.unit === 'servings' ? ' on' : ''}" data-act="unit" data-unit="servings">Servings</button>
      <button class="chip${p.unit === 'grams' ? ' on' : ''}" data-act="unit" data-unit="grams">Grams</button>
    </div>
    <div class="amt"><div class="big num" data-testid="amount">${esc(p.amountStr)}</div><div class="u">${unitLabel}</div></div>
    <div class="res num"><div class="rc"><b>${fmt(r.cal)}</b><span>CALORIES</span></div><div class="rp"><b>${fmt(r.protein)} g</b><span>PROTEIN</span></div></div>
    ${mealSelector(p.meal)}
    <div class="pad">${keys.map(k => `<button data-act="key" data-key="${k}">${k}</button>`).join('')}</div>
    <div class="actions">
      <button class="btn primary big" data-act="save-log" ${amount > 0 ? '' : 'disabled'}>${cta}</button>
      ${p.entryId ? '<button class="btn danger big" data-act="delete-entry">Delete entry</button>' : ''}
    </div>
  </main>`;
}

function renderQuick(p) {
  const e = p.entryId ? S.getEntry(p.entryId) : null;
  const val = k => (e ? esc(k === 'label' ? (e.name === 'Quick add' ? '' : e.name) : e[k]) : '');
  return `<main class="screen page">
    ${nav(e ? 'Edit quick add' : 'Quick add')}
    <div class="form">
      <div class="field"><label for="q-label">Label (optional)</label><input id="q-label" placeholder="e.g. Coffee with milk" value="${val('label')}" autocomplete="off"></div>
      <div class="row2">
        <div class="field"><label for="q-cal" class="c">Calories</label><div class="unit"><input id="q-cal" inputmode="numeric" pattern="[0-9]*" value="${val('cal')}"><span>cal</span></div></div>
        <div class="field"><label for="q-pro" class="p">Protein</label><div class="unit"><input id="q-pro" inputmode="numeric" pattern="[0-9]*" value="${val('protein')}"><span>g</span></div></div>
      </div>
    </div>
    ${mealSelector(p.meal)}
    <div class="err" id="q-err" style="margin:10px 20px 0"></div>
    <div class="actions">
      <button class="btn primary big" data-act="save-quick">${e ? 'Save changes' : `Add to <span id="q-meal">${L.MEAL_LABELS[p.meal]}</span>`}</button>
      ${e ? '<button class="btn danger big" data-act="delete-entry">Delete entry</button>' : ''}
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

// ---------- Page openers ----------
function openLogNew(food) {
  push({ view: 'log', foodId: food.id, name: food.name, snap: { servingGrams: food.servingGrams, cal: food.cal, protein: food.protein },
    unit: 'servings', amountStr: '1', fresh: true, meal: L.mealForTime(now()) });
}

function openEditEntry(e) {
  if (e.kind === 'quick') return push({ view: 'quick', entryId: e.id, meal: e.meal });
  push({ view: 'log', entryId: e.id, name: e.name, snap: e.snapshot, unit: e.unit, amountStr: String(e.amount), fresh: true, meal: e.meal });
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

// ---------- Events ----------
$app.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const p = page();
  const { act } = el.dataset;

  switch (act) {
    case 'tab': ui.tab = el.dataset.tab; popAll(); window.scrollTo(0, 0); break;
    case 'meal-tab': ui.mealTab = el.dataset.meal; render(); break;
    case 'back': pop(); break;
    case 'open-pick': push({ view: 'pick' }); break;
    case 'open-quick': push({ view: 'quick', meal: L.mealForTime(now()) }); break;
    case 'new-food': push({ view: 'food-form' }); break;
    case 'new-food-then-log': push({ view: 'food-form', thenLog: true }); break;
    case 'edit-food': push({ view: 'food-form', foodId: el.dataset.id }); break;
    case 'pick-food': openLogNew(S.getFood(el.dataset.id)); break;
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
      if (p.entryId) {
        S.updateEntry(p.entryId, { unit: p.unit, amount, meal: p.meal });
        toast('Saved');
      } else {
        S.logFood(S.getFood(p.foodId), { date: ui.date, meal: p.meal, unit: p.unit, amount });
        toast(`Added to ${L.MEAL_LABELS[p.meal]}`);
      }
      ui.tab = 'today'; ui.mealTab = p.meal; popAll();
      break;
    }
    case 'save-quick': {
      const cal = num('q-cal');
      const protein = num('q-pro');
      const err = document.getElementById('q-err');
      if (!(cal >= 0)) { err.textContent = 'Enter calories.'; break; }
      if (protein < 0) { err.textContent = 'Protein must be 0 or more.'; break; } // blank = 0
      const data = { label: document.getElementById('q-label').value, cal: Math.round(cal), protein: Math.round(protein || 0), meal: p.meal };
      if (p.entryId) {
        S.updateEntry(p.entryId, { name: data.label.trim() || 'Quick add', cal: data.cal, protein: data.protein, meal: data.meal });
        toast('Saved');
      } else {
        S.quickAdd({ ...data, date: ui.date });
        toast(`Added to ${L.MEAL_LABELS[p.meal]}`);
      }
      ui.tab = 'today'; ui.mealTab = p.meal; popAll();
      break;
    }
    case 'delete-entry':
      if (confirm('Delete this entry?')) { S.deleteEntry(p.entryId); toast('Deleted'); popAll(); }
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
      if (p.thenLog) { ui.stack.pop(); openLogNew(food); } else { toast(p.foodId ? 'Food saved' : 'Food created'); pop(); }
      break;
    }
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
    case 'delete-food':
      if (confirm('Delete this saved food? Entries you already logged stay as they are.')) {
        S.deleteFood(p.foodId); toast('Food deleted'); pop();
      }
      break;
  }
});

$app.addEventListener('input', ev => {
  if (ev.target.id === 'pick-search') fillFoodList('pick');
  if (ev.target.id === 'foods-search') { ui.foodsQuery = ev.target.value; fillFoodList('foods'); }
});

// If the app was left open across 4:01 AM, roll "Today" forward when it comes back.
let shownToday = ui.date;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const today = L.appDateFor(now());
  if (today !== shownToday && ui.date === shownToday && !page()) {
    ui.date = today; ui.mealTab = L.mealForTime(now()); render();
  }
  shownToday = today;
});

render();
