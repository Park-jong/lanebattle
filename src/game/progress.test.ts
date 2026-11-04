import { describe, expect, it } from 'vitest';
import { MemoryProgress } from './progress';

describe('MemoryProgress', () => {
  it('기록이 없으면 0', () => {
    expect(new MemoryProgress().getBestStars(3)).toBe(0);
  });

  it('최고값만 갱신한다', () => {
    const p = new MemoryProgress();
    p.recordResult(0, 2);
    p.recordResult(0, 1);
    expect(p.getBestStars(0)).toBe(2);
    p.recordResult(0, 3);
    expect(p.getBestStars(0)).toBe(3);
  });

  it('스테이지별로 따로 보관한다', () => {
    const p = new MemoryProgress();
    p.recordResult(0, 3);
    p.recordResult(24, 1);
    expect(p.getBestStars(0)).toBe(3);
    expect(p.getBestStars(24)).toBe(1);
    expect(p.getBestStars(1)).toBe(0);
  });

  it('별 수는 0~3으로 맞춘다', () => {
    const p = new MemoryProgress();
    p.recordResult(1, 9);
    expect(p.getBestStars(1)).toBe(3);
    p.recordResult(2, -4);
    expect(p.getBestStars(2)).toBe(0);
    p.recordResult(2, Number.NaN);
    expect(p.getBestStars(2)).toBe(0);
  });

  it('reset은 모두 지운다', () => {
    const p = new MemoryProgress();
    p.recordResult(5, 3);
    p.reset();
    expect(p.getBestStars(5)).toBe(0);
  });

  it('범위 밖 스테이지: 조회는 0, 기록은 RangeError', () => {
    const p = new MemoryProgress();
    expect(p.getBestStars(-1)).toBe(0);
    expect(p.getBestStars(25)).toBe(0);
    expect(() => p.recordResult(-1, 1)).toThrow(RangeError);
    expect(() => p.recordResult(25, 1)).toThrow(RangeError);
    expect(() => p.recordResult(1.5, 1)).toThrow(RangeError);
  });
});
