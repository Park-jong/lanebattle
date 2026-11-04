import { describe, expect, it } from 'vitest';
import type { StageResult } from '../battle/result';
import { MemoryProgress } from './progress';
import { ResultRecorder } from './resultRecorder';

function fakeResult(stars: number, previousBest: number): StageResult {
  return {
    victory: stars > 0,
    stars,
    conditions: { clear: stars > 0, shrineHp: stars > 1, time: stars > 2 },
    yeopjeon: 10,
    sinmyeong: Math.max(0, stars - previousBest),
  };
}

describe('ResultRecorder', () => {
  it('결과가 나기 전에는 기록하지 않는다', () => {
    const store = new MemoryProgress();
    const rec = new ResultRecorder(store);
    expect(rec.settle(0, () => null)).toBeNull();
    expect(store.getBestStars(0)).toBe(0);
  });

  it('이전 최고 별로 계산하고 기록한다', () => {
    const store = new MemoryProgress();
    store.recordResult(2, 1);
    const rec = new ResultRecorder(store);
    const res = rec.settle(2, (prev) => fakeResult(3, prev));
    expect(res?.sinmyeong).toBe(2);
    expect(store.getBestStars(2)).toBe(3);
  });

  it('두 번째 호출은 같은 결과를 돌려주고 다시 계산·기록하지 않는다', () => {
    const store = new MemoryProgress();
    const rec = new ResultRecorder(store);
    let calls = 0;
    const evaluate = (prev: number) => {
      calls++;
      return fakeResult(2, prev);
    };
    const first = rec.settle(0, evaluate);
    const second = rec.settle(0, evaluate);
    expect(second).toBe(first);
    expect(calls).toBe(1);
    expect(first?.sinmyeong).toBe(2);
  });
});
