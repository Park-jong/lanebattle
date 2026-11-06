import { describe, expect, it } from 'vitest';
import { clipFrame, clipSeconds, type CharacterArt } from './art';
import { Locomotion } from './locomotion';

const art: CharacterArt = {
  subjectKey: 'hero:kkomaMudang', texture: 'shion', image: '', atlas: '',
  origin: { x: .5, y: .875 }, bodyWidth: 40, bodyHeight: 112.5, canvas: { width: 256, height: 256 },
  clips: { idle: { frames: ['idle_00'], fps: 8, loop: true },
    walk: { frames: Array.from({ length: 12 }, (_, i) => `walk_${String(i).padStart(2, '0')}`),
      fps: 14, loop: true, strideLength: 90 } },
};
const travel = (distance: number, displayScale = 1) => ({ distance, displayScale });

describe('distance-driven walking', () => {
  it('uses equal phases for equal distances regardless of frame rate or time', () => {
    const a = new Locomotion(1), b = new Locomotion(1);
    for (let i = 0; i < 30; i++) a.update(art, 1/60, true, 1, travel(1));
    const result = b.update(art, .5, true, 1, travel(30));
    expect(a.update(art, 0, true, 1, travel(0)).age).toBeCloseTo(result.age);
    expect(clipFrame(art, 'walk', result.age)).toBe('walk_04');
  });
  it('matches stride to displayed size and loops smoothly after one full stride', () => {
    const movement = new Locomotion(1);
    const half = movement.update(art, .5, true, 1, travel(90, 2));
    expect(half.age).toBeCloseTo(clipSeconds(art, 'walk') / 2);
    expect(clipFrame(art, 'walk', half.age)).toBe('walk_06');
    const full = movement.update(art, .5, true, 1, travel(90, 2));
    expect(clipFrame(art, 'walk', full.age)).toBe('walk_00');
  });
  it('freezes for zero travel and paused time, then returns to idle when stopped', () => {
    const movement = new Locomotion(1);
    const before = movement.update(art, .2, true, 1, travel(35));
    expect(movement.update(art, 1, true, 1, travel(0))).toEqual(before);
    expect(movement.update(art, 0, true, 1, travel(50))).toEqual(before);
    expect(movement.update(art, .1, false, 1, travel(0)).clip).toBe('idle');
    expect(movement.update(art, .01, true, -1, travel(0)).age).toBe(0);
  });
  it('retains clock-driven playback for legacy clips without stride metadata', () => {
    const legacy = { ...art, clips: { ...art.clips, walk: { ...art.clips.walk, strideLength: undefined } } };
    const movement = new Locomotion(1);
    movement.update(legacy, .1, true, 1, travel(0));
    expect(movement.update(legacy, .2, true, 1, travel(0)).age).toBeCloseTo(.2);
  });
});
