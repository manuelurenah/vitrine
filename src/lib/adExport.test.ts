import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cropToExactPng } from './adExport';

async function solidPng(w: number, h: number): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

describe('cropToExactPng', () => {
  it('produces an image at exactly the target pixel size (extreme landscape)', async () => {
    const src = await solidPng(2048, 1152); // 16:9 source
    const out = await cropToExactPng(src, 728, 90);
    const meta = await sharp(Buffer.from(out)).metadata();
    expect(meta.width).toBe(728);
    expect(meta.height).toBe(90);
    expect(meta.format).toBe('png');
  });

  it('handles portrait targets', async () => {
    const src = await solidPng(1152, 2048); // 9:16 source
    const out = await cropToExactPng(src, 300, 600);
    const meta = await sharp(Buffer.from(out)).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(600);
  });

  it('handles square-ish targets', async () => {
    const src = await solidPng(1024, 1024);
    const out = await cropToExactPng(src, 300, 250);
    const meta = await sharp(Buffer.from(out)).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(250);
  });
});
