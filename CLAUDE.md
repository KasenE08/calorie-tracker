# Notes for Claude

- Read `SPEC.md` (including the Decisions Log at the bottom) before changing behavior.
- Kasen wants changes pushed straight to `main` (GitHub Pages deploys from it) — no need to ask.
- Before every push that changes app files: `npm run stamp`, then `npm test` and the
  `tools/e2e-phase*.mjs` runs (`TZ=UTC node tools/e2e-phase1.mjs` … `phase4`).
- Meal windows (by the minute): Breakfast 4:01–11:00 AM, Lunch 11:01 AM–4:00 PM,
  Dinner 4:01–9:00 PM, Late Night 9:01 PM–4:00 AM (12:00–4:00 AM counts toward the previous date).
