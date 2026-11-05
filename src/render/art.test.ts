import { describe, expect, it } from 'vitest';
import { artAssetUrl, artFor, artList, clipFrame, type CharacterArt } from './art';

const art: CharacterArt = {
  subjectKey: 'ally:clubGoblin', texture: 'ally-clubGoblin', image: 'runtime/ally-clubGoblin.png', atlas: 'runtime/ally-clubGoblin.json',
  origin: { x: 0.5, y: 0.875 }, bodyWidth: 40, bodyHeight: 60, canvas: { width: 76, height: 96 },
  clips: { idle: { frames: ['idle_00'], fps: 2, loop: true }, walk: { frames: ['walk_00', 'walk_01'], fps: 8, loop: true },
    death: { frames: ['death_00', 'death_01'], fps: 8, loop: false } },
};

describe('character asset resolution', () => {
  it('retains the deployment base, including subdirectory builds', () => {
    expect(artAssetUrl('runtime/a.png', '/lanebattle/')).toBe('/lanebattle/assets/characters/runtime/a.png');
    expect(artAssetUrl('manifest.json', './')).toBe('./assets/characters/manifest.json');
  });
  it('keeps malformed or unavailable manifests on the shape fallback path', () => {
    for (const raw of [null, {}, { characters: 'bad' }, { characters: [{ ...art, bodyHeight: 0 }] },
      { characters: [{ ...art, displayHeight: -1 }] }, { characters: [{ ...art, displayTop: NaN }] }]) expect(artList(raw)).toEqual([]);
    expect(artFor({ characters: [art] }, 'enemy:clubGoblin')).toBeUndefined();
  });
  it('loops movement, holds the last death frame, and falls back to idle for a missing clip', () => {
    expect(clipFrame(art, 'walk', 0.25)).toBe('walk_00');
    expect(clipFrame(art, 'death', 100)).toBe('death_01');
    expect(clipFrame(art, 'not-ready', 100)).toBe('idle_00');
  });
});
