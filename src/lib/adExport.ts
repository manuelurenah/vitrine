import 'server-only';
import sharp from 'sharp';

/**
 * Center-crop + scale an image to EXACTLY width×height pixels. `fit:'cover'`
 * fills the target rectangle (cropping the overflow), `position:'centre'` keeps
 * the middle band — the right behaviour for ad creatives composed center-safe.
 */
export async function cropToExactPng(
  bytes: Uint8Array | ArrayBuffer,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const out = await sharp(buf)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
  return new Uint8Array(out);
}
