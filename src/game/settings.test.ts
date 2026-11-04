import { describe, expect, it } from 'vitest';
import { clampVolume, MemorySettings, volumeFromRatio } from './settings';

describe('settings', () => {
  it('값을 0~100 정수로 맞춘다', () => {
    expect(clampVolume(-5)).toBe(0);
    expect(clampVolume(150)).toBe(100);
    expect(clampVolume(42.6)).toBe(43);
    expect(clampVolume(Number.NaN)).toBe(70);
  });

  it('슬라이더 비율을 소리 크기로 바꾼다', () => {
    expect(volumeFromRatio(0)).toBe(0);
    expect(volumeFromRatio(0.5)).toBe(50);
    expect(volumeFromRatio(2)).toBe(100);
    expect(volumeFromRatio(-1)).toBe(0);
  });

  it('저장소는 범위를 넘는 값을 클램프하고 reset으로 되돌린다', () => {
    const s = new MemorySettings();
    expect(s.musicVolume).toBe(70);
    s.setMusicVolume(999);
    s.setSfxVolume(-3);
    expect(s.musicVolume).toBe(100);
    expect(s.sfxVolume).toBe(0);
    s.reset();
    expect(s.musicVolume).toBe(70);
    expect(s.sfxVolume).toBe(70);
  });
});
