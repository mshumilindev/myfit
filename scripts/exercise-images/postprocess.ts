/**
 * Normalise provider output into the app asset: cover-resize to the output
 * size (3:2, same as the originals the UI already crops), sRGB, metadata
 * stripped, one fixed encoder setting — so every file is encoded exactly once
 * from the lossless source and never re-compressed.
 *
 * Uses `sharp` (root devDependency). Loaded lazily so the rest of the tool
 * (dry-run, review, tests) works even where sharp's native binary is missing.
 */
import type { PipelineConfig } from './config';

type SharpFn = (input: Buffer) => {
  rotate(): ReturnType<SharpFn>;
  resize(o: {
    width: number;
    height: number;
    fit: 'cover';
    position: 'centre';
  }): ReturnType<SharpFn>;
  toColorspace(c: 'srgb'): ReturnType<SharpFn>;
  webp(o: { quality: number; effort: number }): ReturnType<SharpFn>;
  jpeg(o: { quality: number; mozjpeg: boolean }): ReturnType<SharpFn>;
  png(o: { compressionLevel: number }): ReturnType<SharpFn>;
  toBuffer(): Promise<Buffer>;
};

let sharpFn: SharpFn | null = null;
async function loadSharp(): Promise<SharpFn> {
  if (sharpFn) return sharpFn;
  try {
    // Variable specifier: typechecks (and tests import this file) without sharp installed.
    const name = 'sharp';
    const mod = (await import(name)) as { default: SharpFn };
    sharpFn = mod.default;
    return sharpFn;
  } catch (e) {
    throw new Error(
      `post-processing needs "sharp" — run \`npm install\` in the repo root (${(e as Error).message})`,
      { cause: e },
    );
  }
}

export async function normalize(input: Buffer, c: PipelineConfig): Promise<Buffer> {
  const sharp = await loadSharp();
  // rotate() applies EXIF orientation; sharp drops metadata unless asked to keep it.
  const img = sharp(input)
    .rotate()
    .resize({ width: c.outputSize.w, height: c.outputSize.h, fit: 'cover', position: 'centre' })
    .toColorspace('srgb');
  if (c.outputFormat === 'webp')
    return img.webp({ quality: c.outputQuality, effort: 5 }).toBuffer();
  if (c.outputFormat === 'jpeg')
    return img.jpeg({ quality: c.outputQuality, mozjpeg: true }).toBuffer();
  return img.png({ compressionLevel: 9 }).toBuffer();
}

export const extFor = (f: PipelineConfig['outputFormat']) => (f === 'jpeg' ? 'jpg' : f);
