// Renders the chosen icon (Icon 3: Plate) to every size the app needs.
// Usage: node tools/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(`${root}/icons/concepts/icon-3.svg`, 'utf8');
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// Maskable (Android): keep everything inside the central 80% "safe zone".
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#fff"/>
  <g transform="translate(51.2 51.2) scale(0.8)">${inner}</g></svg>`;

const jobs = [
  ['icon-180.png', 180, svg], // apple-touch-icon
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, svg],
  ['icon-maskable-512.png', 512, maskable],
  ['favicon-32.png', 32, svg],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, src] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  const sized = src.replace('<svg ', `<svg width="${size}" height="${size}" `).replace(/ width="512" height="512"/, '');
  await page.setContent(`<html><body style="margin:0;background:#fff">${sized}</body></html>`);
  await page.screenshot({ path: `${root}/icons/${name}`, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('icons written');
