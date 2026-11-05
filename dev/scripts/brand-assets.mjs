// Gera ícones do app, favicon e telas de abertura do iPhone a partir de public/brand/seven-star.svg.
// Uso: npm run brand   (rodar de novo quando o arquivo oficial da estrela chegar)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const font = fs.readFileSync(path.join(root, 'node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2')).toString('base64');
const star = fs.readFileSync(path.join(root, 'public/brand/seven-star.svg'), 'utf8').replace('currentColor', '#C9AFA8');
// [largura CSS, altura CSS, densidade] dos iPhones em uso
export const SIZES = [[440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [414, 896, 3], [375, 812, 3], [414, 896, 2], [375, 667, 2]];

const raw = fs.readFileSync(path.join(root, 'public/brand/seven-star.svg'), 'utf8');
// [arquivo, tamanho, escala da estrela, fundo]
const ICONS = [['icons/icon-192.png', 192, 0.62, '#450B18'], ['icons/icon-512.png', 512, 0.62, '#450B18'],
  ['icons/icon-maskable-512.png', 512, 0.46, '#450B18'], ['icons/apple-touch-icon.png', 180, 0.6, '#450B18'],
  ['favicon.png', 48, 0.78, '#450B18'], ['icons/badge-96.png', 96, 0.86, 'transparent']];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const [w, h, d] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: d });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: P; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 400 900; }
    html,body { margin:0; height:100%; background:#450B18; }
    body { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; font-family:P, serif; color:#F4EBDD; }
    svg { width:64px; height:64px; }
    h1 { font-weight:400; font-size:26px; letter-spacing:.22em; margin:0; padding-left:.22em; }
    p { font-size:11px; letter-spacing:.5em; margin:0; color:#C9AFA8; padding-left:.5em; }
  </style></head><body>${star}<h1>THE SEVEN CLUB</h1><p>BORN TO LEAD.</p></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, `public/splash/splash-${w * d}x${h * d}.png`) });
  await page.close();
}
for (const [file, size, scale, bg] of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const color = bg === 'transparent' ? '#FFFFFF' : '#F4EBDD';
  await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg}">
    <div style="width:${size * scale}px;height:${size * scale}px">${raw.replace('currentColor', color).replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path: path.join(root, 'public', file), omitBackground: bg === 'transparent' });
  await page.close();
}
await browser.close();
console.log(`${ICONS.length} ícones e ${SIZES.length} telas de abertura gerados em public/`);
