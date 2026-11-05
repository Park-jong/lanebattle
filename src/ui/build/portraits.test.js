import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALLIES } from '../../data/allies';

const atlas = JSON.parse(readFileSync(new URL('../../../public/assets/ui/build/military-portraits.json', import.meta.url), 'utf8'));
const png = readFileSync(new URL('../../../public/assets/ui/build/military-portraits.png', import.meta.url));

describe('배포용 밀리터리 초상화 아틀라스', () => {
  it('10종이 중복·누락 없이 포함되고 PNG 크기와 모든 프레임 경계가 일치한다', () => {
    expect(Object.keys(atlas.frames).sort()).toEqual(ALLIES.map(a => a.id).sort());
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(atlas.meta.size).toEqual({ w: png.readUInt32BE(16), h: png.readUInt32BE(20) });
    const frames = Object.values(atlas.frames).map(f => f.frame);
    frames.forEach((frame, i) => {
      expect(frame.w).toBe(96);
      expect(frame.h).toBe(96);
      expect(frame.x).toBeGreaterThanOrEqual(2);
      expect(frame.y).toBeGreaterThanOrEqual(2);
      expect(frame.x + frame.w).toBeLessThanOrEqual(atlas.meta.size.w - 2);
      expect(frame.y + frame.h).toBeLessThanOrEqual(atlas.meta.size.h - 2);
      frames.slice(i + 1).forEach(other => {
        expect(frame.x < other.x + other.w && other.x < frame.x + frame.w && frame.y < other.y + other.h && other.y < frame.y + frame.h).toBe(false);
      });
    });
    expect(atlas.meta.skinId).toBe('military');
    expect(atlas.meta.scope).toBe('build-ui-only');
    expect(png.byteLength).toBeLessThan(256 * 1024);
  });
});
