import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { artFor, artList, clipFrame } from './art';
import { Locomotion } from './locomotion';

const read = (path: string) => JSON.parse(readFileSync(`public/assets/characters/${path}`, 'utf8'));
const original = artList(read('manifest.json'));
const military = artList(read('military-manifest.json'));
const shion = military.find(a => a.subjectKey === 'hero:kkomaMudang')!;

describe('playable military assets', () => {
  it('covers all 26 subjects and resolves both skins with a default fallback', () => {
    expect(military).toHaveLength(26);
    expect(new Set(military.map(a => a.subjectKey))).toEqual(new Set(original.map(a => a.subjectKey)));
    const combined = { characters: [...original, ...military] };
    for (const art of military) {
      expect(artFor(combined, art.subjectKey, 'military')).toBe(art);
      expect(artFor(combined, art.subjectKey)?.skinId).toBe('default');
    }
    expect(artFor({ characters: original }, shion.subjectKey, 'military')?.skinId).toBe('default');
  });
  it('ships every referenced frame inside its atlas, including skill icons and projectiles', () => {
    for (const art of military) {
      expect(existsSync(`public/assets/characters/${art.image}`)).toBe(true);
      const atlas = read(art.atlas);
      for (const name of ['idle', 'walk', 'attack', 'hit', 'spawn', 'death']) expect(art.clips[name]?.frames.length).toBeGreaterThan(0);
      for (const clip of Object.values(art.clips)) for (const name of clip.frames) expect(atlas.frames[name]).toBeTruthy();
      for (const name of ['icon', 'preview']) expect(atlas.frames[name]).toBeTruthy();
      for (const { frame } of Object.values(atlas.frames) as { frame: { x: number; y: number; w: number; h: number } }[]) {
        expect(frame.x + frame.w).toBeLessThanOrEqual(atlas.meta.size.w);
        expect(frame.y + frame.h).toBeLessThanOrEqual(atlas.meta.size.h);
      }
    }
    const frames = read(shion.atlas).frames;
    for (const key of ['hero-kkomaMudang-q', 'hero-kkomaMudang-w', 'hero-kkomaMudang-e']) expect(frames[key]).toBeTruthy();
    expect(clipFrame(shion, 'attack', 0)).toBe('attack_00');
    expect(clipFrame(shion, 'attack', 1 / 18)).toBe('attack_01');
    expect(shion.clips.walk.frames.slice(0, 4)).toEqual(['walk_00', 'walk_04', 'walk_01', 'walk_05']);
  });
  it('uses movement transitions, freezes on pause, and tolerates original skins without transitions', () => {
    const movement = new Locomotion(1);
    expect(movement.update(shion, 0, false, 1).clip).toBe('idle');
    expect(movement.update(shion, 0.01, true, 1)).toEqual({ clip: 'start', age: 0 });
    expect(movement.update(shion, 0, true, 1)).toEqual({ clip: 'start', age: 0 });
    expect(movement.update(shion, 0.3, true, 1).clip).toBe('walk');
    expect(movement.update(shion, 0.01, true, -1).clip).toBe('turn');
    expect(movement.update(shion, 0.3, false, -1).clip).toBe('stop');
    expect(movement.update(shion, 0.3, false, -1).clip).toBe('idle');
    expect(new Locomotion(1).update(original[0], 0.01, true, 1).clip).toBe('walk');
  });
});
