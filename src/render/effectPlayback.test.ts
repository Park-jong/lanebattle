import { describe, expect, it } from 'vitest';
import { EffectPlayback, EFFECT_LIMITS, effectFrameIndex, type EffectRequest } from './effectPlayback';
import { PIXELFX } from './pixelfxManifest';

const clips = PIXELFX.clips.default;
const request: EffectRequest = { clip: 'slash', x: 200, y: 300, width: 60, depth: 25 };

describe('bounded effect playback', () => {
  it('freezes all clocks at zero delta, respects delayed starts and reclaims completed effects', () => {
    const playback = new EffectPlayback();
    const fx = playback.play({ ...request, delay: .1, duration: .3 })!;
    playback.beginFrame(0, clips);
    expect(fx.age).toBe(-.1);
    playback.beginFrame(.15, clips);
    expect(fx.age).toBeCloseTo(.05);
    playback.beginFrame(.25, clips);
    expect(playback.entries).toHaveLength(0);
  });

  it('reserves capacity for hero/boss effects during ordinary hit storms', () => {
    const playback = new EffectPlayback();
    for (let frame = 0; frame < 4; frame++) {
      playback.beginFrame(0, clips);
      for (let hit = 0; hit < 100; hit++) playback.play(request);
    }
    expect(playback.entries).toHaveLength(EFFECT_LIMITS.ordinary);
    expect(playback.play({ ...request, priority: 2 })).toBeDefined();
    for (let hit = 0; hit < 100; hit++) playback.play({ ...request, priority: 2 });
    expect(playback.entries).toHaveLength(EFFECT_LIMITS.total);
  });

  it('bounds persistent loops and removes them explicitly, independent of duration', () => {
    const playback = new EffectPlayback();
    for (let i = 0; i < 100; i++) playback.play({ ...request, clip: 'stun', persistent: true });
    expect(playback.entries).toHaveLength(EFFECT_LIMITS.persistent);
    playback.beginFrame(100, clips);
    expect(playback.entries).toHaveLength(EFFECT_LIMITS.persistent);
    playback.stop(playback.entries[0]);
    expect(playback.entries).toHaveLength(EFFECT_LIMITS.persistent - 1);
    playback.clear();
    expect(playback.entries).toHaveLength(0);
  });

  it('wraps loops and holds the last transient frame without out-of-bounds indexing', () => {
    expect(effectFrameIndex(clips.stun, 0)).toBe(0);
    expect(effectFrameIndex(clips.stun, clips.stun.duration, undefined, true)).toBe(0);
    expect(effectFrameIndex(clips.slash, 100)).toBe(clips.slash.frames.length - 1);
    expect(effectFrameIndex(clips.slash, -.1)).toBe(0);
  });
});
