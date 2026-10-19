// Renders Phase 0 mockups + icon concepts with headless Chromium (390x844).
// Usage: node tools/screenshot-phase0.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = `${root}/screenshots/phase-0`;
const browser = await chromium.launch();
// Dark color scheme on purpose: proves the white background holds in iOS dark mode.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const page = await ctx.newPage();

for (const L of ['a', 'b', 'c']) {
  const url = `file://${root}/mockups/layout-${L}.html`;
  await page.goto(url);
  await page.screenshot({ path: `${out}/Layout ${L.toUpperCase()} - home.png` });
  await page.screenshot({ path: `${out}/Layout ${L.toUpperCase()} - home (full scroll).png`, fullPage: true });
  await page.goto(url + '?sheet=1');
  await page.screenshot({ path: `${out}/Layout ${L.toUpperCase()} - add food.png` });
}

// Icons: each concept as a 512px PNG (deviceScaleFactor 1)
const iconCtx = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
const ip = await iconCtx.newPage();
const svgs = [1, 2, 3, 4].map(n => readFileSync(`${root}/icons/concepts/icon-${n}.svg`, 'utf8'));
for (const [i, svg] of svgs.entries()) {
  await ip.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await ip.locator('svg').screenshot({ path: `${root}/icons/concepts/icon-${i + 1}.png` });
  await ip.locator('svg').screenshot({ path: `${out}/Icon ${i + 1}.png` });
}

// Icon overview: all 4 with iOS-style rounded corners, big + home-screen size
const sheetCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const sp = await sheetCtx.newPage();
const names = ['Rings', 'Flame', 'Plate', 'Bars'];
const uri = s => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64');
await sp.setContent(`<html><body style="margin:0;background:#fff;font-family:-apple-system,Helvetica,Arial,sans-serif">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:26px 18px;padding:34px 24px">
  ${svgs.map((s, i) => `<div style="text-align:center">
     <img src="${uri(s)}" style="width:150px;height:150px;border-radius:34px;box-shadow:0 0 0 1px #e5e5ea,0 6px 16px rgba(0,0,0,.12)">
     <div style="font-weight:800;font-size:17px;margin-top:10px">Icon ${i + 1}</div>
     <div style="color:#6b6b70;font-size:14px">${names[i]}</div></div>`).join('')}
  </div>
  <div style="margin:6px 24px 0;padding:22px 16px;border-radius:24px;background:linear-gradient(#5b6b8c,#2a3550)">
    <div style="color:#fff;font-size:12px;font-weight:600;margin-bottom:12px;opacity:.8">At home-screen size</div>
    <div style="display:flex;justify-content:space-between">
    ${svgs.map((s, i) => `<div style="text-align:center"><img src="${uri(s)}" style="width:62px;height:62px;border-radius:14px">
       <div style="color:#fff;font-size:11px;margin-top:5px">Icon ${i + 1}</div></div>`).join('')}
    </div></div></body></html>`);
await sp.screenshot({ path: `${out}/Icons - overview.png` });

await browser.close();
console.log('done');
