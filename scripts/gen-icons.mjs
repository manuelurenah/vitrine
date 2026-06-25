import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const logo = await readFile('public/brand/logomark.svg');

// 32x32 PNG favicon (transparent bg, just the V)
await sharp(logo).resize(32, 32).png().toFile('src/app/icon.png');

// 180x180 apple-icon: V centered on rounded brand-dark square
const appleBg = Buffer.from(
  `<svg width="180" height="180"><rect width="180" height="180" rx="40" fill="#0a0a0f"/></svg>`
);
const v = await sharp(logo).resize(120, 120).png().toBuffer();
await sharp(appleBg)
  .composite([{ input: v, gravity: 'center' }])
  .png()
  .toFile('src/app/apple-icon.png');

// 1200x630 OG image: V + "vitrine" wordmark feel on brand-dark
const ogBg = Buffer.from(
  `<svg width="1200" height="630"><rect width="1200" height="630" fill="#0a0a0f"/>` +
    `<text x="600" y="370" font-family="sans-serif" font-size="64" font-weight="700" fill="#ffffff" text-anchor="middle">vitrine</text>` +
    `<text x="600" y="430" font-family="sans-serif" font-size="28" fill="#9a9aa5" text-anchor="middle">your brand, shot on demand.</text></svg>`
);
const vBig = await sharp(logo).resize(180, 180).png().toBuffer();
await sharp(ogBg)
  .composite([{ input: vBig, top: 110, left: 510 }])
  .png()
  .toFile('public/brand/og.png');

console.log('icons + og generated');
