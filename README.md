# Calorie Tracker

A free calorie + protein tracker for iPhone, installed from Safari as a home-screen app.
Live: https://kasene08.github.io/calorie-tracker/

- Vanilla HTML/CSS/JS, no build step, no backend. Data stays on the phone (localStorage).
- Works offline (service worker). Shows an "Update" banner when a new version is deployed.
- Export/Import a JSON backup in Settings.

See `SPEC.md` for the full spec and the decisions log.

## Develop

```sh
node tools/serve.mjs 8080      # http://localhost:8080/
npm test                       # unit tests (meal times, scaling, backup, version stamp)
TZ=UTC node tools/e2e-phase4.mjs   # end-to-end runs (phase 1–4) + screenshots
```

**Before pushing app changes run `npm run stamp`.** It writes a new version into `sw.js`,
which is what makes installed phones show the update banner. `npm test` fails if you forget.
