import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PIXELFX } from './pixelfxManifest';

describe('shipped pixelfx atlases', () => {
  it('contains every color/glow frame for both skins inside bounded PNG textures with stable trim canvases', () => {
    const atlases = new Map();
    for (const page of PIXELFX.pages) {
      const png = readFileSync(`public/assets/effects/${page.image}`);
      const atlas = JSON.parse(readFileSync(`public/assets/effects/${page.atlas}`, 'utf8'));
      expect(png.readUInt32BE(16)).toBe(page.width);
      expect(png.readUInt32BE(20)).toBe(page.height);
      expect(Math.max(page.width, page.height)).toBeLessThanOrEqual(2048);
      atlases.set(page.texture, atlas);
    }
    for (const clips of Object.values(PIXELFX.clips)) for (const clip of Object.values(clips)) {
      expect(clip.duration).toBeGreaterThan(0);
      expect(clip.frames.length).toBeGreaterThan(1);
      expect(clip.origin.every(Number.isFinite)).toBe(true);
      for (const pair of clip.frames) for (const ref of Object.values(pair)) {
        const atlas = atlases.get(ref.texture), frame = atlas.frames[ref.frame];
        expect(frame.sourceSize).toEqual({ w: clip.width, h: clip.height });
        expect(frame.frame.x + frame.frame.w).toBeLessThanOrEqual(atlas.meta.size.w);
        expect(frame.frame.y + frame.frame.h).toBeLessThanOrEqual(atlas.meta.size.h);
        expect(frame.spriteSourceSize.x + frame.spriteSourceSize.w).toBeLessThanOrEqual(clip.width);
        expect(frame.spriteSourceSize.y + frame.spriteSourceSize.h).toBeLessThanOrEqual(clip.height);
      }
    }
  });
});
