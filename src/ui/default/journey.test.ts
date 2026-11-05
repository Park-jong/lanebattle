import { describe, expect, it } from 'vitest';
import { STAGES } from '../../data/stages';
import { recommendedStage } from './journey';

describe('여정 이어가기', () => {
  it('기록이 없거나 아직 도전하지 않은 관문부터 안내한다', () => {
    expect(recommendedStage([])).toBe(0);
    expect(recommendedStage([3, 1, 0, 3])).toBe(2);
  });
  it('전 관문을 클리어하면 별이 부족한 첫 관문을 안내한다', () => {
    const stars = STAGES.map(() => 3);
    stars[12] = 2;
    expect(recommendedStage(stars)).toBe(12);
  });
  it('별을 모두 모은 기록은 마지막 관문을 유지한다', () => {
    expect(recommendedStage(STAGES.map(() => 3))).toBe(STAGES.length - 1);
  });
});
