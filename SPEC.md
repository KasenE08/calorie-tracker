# Calorie Tracker — Full Build Instructions for Claude Code

You are building a free calorie + protein tracker PWA for me. Work through the phases below IN ORDER. At the end of EVERY phase: take screenshots, give me a short bullet summary, ask any questions you need answered, then STOP and wait for my reply before starting the next phase. Never skip ahead.

FIRST ACTION: save this entire file as SPEC.md in the repo root. Re-read it at the start of each phase. When I answer questions, record my decisions at the bottom of SPEC.md under "Decisions Log".

---

## Project basics
- GitHub user: KasenE08
- Repo: calorie-tracker (public)
- Hosting: GitHub Pages → https://kasene08.github.io/calorie-tracker/
- Installed to my iPhone home screen as a PWA
- Stack: vanilla HTML/CSS/JS, no build step, no backend, no paid services
- Screenshots: use Playwright (headless) at 390x844 (iPhone portrait), save them into /screenshots/phase-N/, and show them to me

## SPEC

### Look
- Portrait only, phone-first
- Background is ALWAYS white, even in iOS dark mode. Text is black.
- Calories = blue. Protein = orange. Calories over goal = red.

### Home screen
- Top: swipeable week strip (Mon–Sun). Swipe left/right to change weeks, tap a day to view it, today is highlighted.
- Center: a BIG number showing calories remaining for the selected day (goal − eaten). When over the goal, it goes negative and turns red.
- Progress bars: calories (blue) and protein (orange), each showing eaten vs. goal (e.g. "1,840 / 2,600 cal", "142 / 180 g").
- Below: meal sections — Breakfast, Lunch, Dinner, Late Night — each listing its entries with calories + protein and a subtotal.

### Goals
- One daily calorie goal and one daily protein goal (grams), both typed in by me in Settings. They are the same every day.

### Meal assignment (by the clock time when I log the item)
- Breakfast: 6:00 AM – 11:00 AM
- Lunch: 11:01 AM – 4:00 PM
- Dinner: 4:01 PM – 12:00 AM (midnight)
- Late Night: 12:01 AM – 5:59 AM, and it counts toward the PREVIOUS day
- The "app day" runs 6:00 AM → 5:59 AM the next morning. At 1:00 AM the app opens to the previous date.
- When logging on a past or future day, the meal still auto-fills from the current clock time.
- Every entry is editable afterward: change the amount or move it to a different meal.

### Saved foods
- Fields: name, serving size (grams), calories per serving, protein per serving.
- When logging, I choose either "servings" (e.g. 1.5) or "grams" (e.g. 220 g), and calories + protein scale to match.
- Create, edit, delete, and search saved foods.
- Editing a saved food must NOT change entries already logged (store a snapshot of the values on each entry).

### Quick add
- Log calories + protein directly without saving a food. An optional label is allowed.

### Saved meals + repeat
- Save a group of foods as a named meal (e.g. "Usual breakfast"), organized by meal category.
- Add a saved meal to any day in one tap.
- "Repeat" copies a meal from a previous day into the selected day.
- Everything added this way stays editable.

### Data
- Track ONLY calories and protein. No carbs or fat.
- Storage on the device (localStorage or IndexedDB).
- Settings has Export (downloads a JSON backup) and Import (restores from that file, with a confirm step before overwriting).

### PWA
- manifest.json, service worker, works fully offline, portrait orientation
- Custom home-screen icon: apple-touch-icon 180px, plus 192px and 512px

---

## PHASE 0 — Design options (NO app code yet)
1. Create the repo structure and save SPEC.md.
2. Make 3 distinctly different UI layout mockups as static HTML following the SPEC and colors. For each layout, show the home screen with realistic sample data and the add-food sheet.
3. Make 4 different icon concepts as SVG and render each as a 512px PNG.
4. Screenshot everything into /screenshots/phase-0/, labeled "Layout A/B/C" and "Icon 1/2/3/4".
5. Give me 1–2 bullets of pros/cons for each layout.
6. Ask me which layout and which icon I pick, plus any other questions. STOP.

## PHASE 1 — Foods + logging
- Build the real app using my chosen layout. Include:
  - saved foods (create/edit/delete/search, servings or grams)
  - quick add
  - logging with automatic meal assignment, including the late night → previous day rule
  - editing entries (amount + meal)
  - local storage
- Write tests for the meal/app-day logic, covering exact boundaries: 5:59, 6:00, 11:00, 11:01, 4:00 PM, 4:01 PM, 12:00 AM, 12:01 AM.
- Screenshots, summary, questions. STOP.

## PHASE 2 — Goals + big number + bars
- Settings for the calorie and protein goals.
- The big calories-remaining number, which goes negative and turns red when over.
- The blue calorie bar and orange protein bar.
- Screenshot under-goal, near-goal, and over-goal states.
- Summary, questions. STOP.

## PHASE 3 — Calendar + saved meals
- The swipeable week strip, plus viewing and logging on past and future days.
- Saved meals and "repeat a previous day's meal" (all editable after adding).
- Screenshots, summary, questions. STOP.

## PHASE 4 — PWA + backup + deploy
- manifest, service worker (offline), the chosen icon at all sizes including apple-touch-icon, and portrait lock.
- Export/Import JSON in Settings.
- Commit and push to KasenE08/calorie-tracker, enable GitHub Pages, and confirm the live URL loads.
- Give me step-by-step instructions to add it to my iPhone home screen, final screenshots, and a summary.
- Remind me to export backups regularly: deleting the home-screen app or clearing website data wipes all logs.

---

## Decisions Log
(Claude Code: append my answers here after each phase.)

### After Phase 0 (2026-10-19)
- **Layout:** B (dashboard + meal tabs + bottom tab bar; full-page add-food with number pad).
- **Icon:** 3 (Plate: fork + knife, plate rim split blue/orange).
- **Meal times CHANGED (replaces the original meal table above):**
  - Breakfast: **4:01 AM – 11:00 AM**
  - Lunch: 11:01 AM – 4:00 PM
  - Dinner: **4:01 PM – 9:00 PM** (9:00 PM exactly = Dinner)
  - Late Night: **9:01 PM – 4:00 AM**. Entries from 12:00 AM – 4:00 AM count toward the PREVIOUS date.
  - The app day runs **4:01 AM → 4:00 AM** the next morning. At 1:00 AM the app opens to the previous date; at 4:01 AM it opens to the new date.
- **Time precision:** go by the minute, ignore seconds (e.g. 11:00:45 = 11:00).
- **Protein:** whole grams everywhere (round to nearest gram). Calories are whole numbers too.
- **Git:** Claude pushes to `main` automatically at the end of each phase (and whenever useful), no need to ask. Git permissions are pre-approved in `.claude/settings.json`.

### After Phase 1 (2026-10-19)
- **First launch:** start with placeholder goals **2,600 cal / 180 g**, changeable in Settings (no setup prompt).
- **Colors:** calories stay **blue** until actually over the goal (remaining < 0), then the number and calorie bar turn **red**. No "near goal" warning color. Exactly at goal (0 remaining) is still blue.

### After Phase 2 (2026-10-19)
- **Creating saved meals:** both ways — "Save as meal" from a day's meal tab, AND build one from scratch in the Meals tab. Saved meals are listed under their category (Breakfast/Lunch/Dinner/Late Night).
- **Adding a saved meal / Repeat:** entries go into the meal for the **current clock time when you add them** (same rule as all logging), not the category the meal was saved under. Everything stays editable afterward.
- **Week strip:** keep the small progress ring around each day (blue; red on days over the calorie goal).
