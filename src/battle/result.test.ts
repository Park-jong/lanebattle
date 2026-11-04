import { describe, expect, it } from 'vitest';
import { STAGES } from '../data/stages';
import { Battle } from './battle';
import { SeededRng } from './rng';
import { evaluateStage, type StageResultInput } from './result';

const NORMAL = STAGES[0]; // 1-1, 제한 200초
const BOSS = STAGES[4]; // 1-5, 제한 300초
const win = (over: Partial<StageResultInput> = {}) =>
  evaluateStage({ victory: true, elapsed: 100, shrineHpRatio: 1, stage: NORMAL, ...over });

describe('별 판정', () => {
  it('패배면 별 0, 엽전 0, 신명 0', () => {
    const r = evaluateStage({ victory: false, elapsed: 10, shrineHpRatio: 1, stage: NORMAL });
    expect(r.stars).toBe(0);
    expect(r.yeopjeon).toBe(0);
    expect(r.sinmyeong).toBe(0);
    expect(r.conditions).toEqual({ clear: false, shrineHp: false, time: false });
  });

  it('체력 정확히 50%는 별 2 이상, 49.9%는 별 1', () => {
    expect(win({ shrineHpRatio: 0.5, elapsed: 250 }).stars).toBe(2);
    expect(win({ shrineHpRatio: 0.499, elapsed: 10 }).stars).toBe(1);
    expect(win({ shrineHpRatio: 0.499 }).conditions).toEqual({ clear: true, shrineHp: false, time: false });
  });

  it('시간 정확히 200초는 별 3, 200.05초는 별 2', () => {
    expect(win({ elapsed: 200 }).stars).toBe(3);
    expect(win({ elapsed: 200.05 }).stars).toBe(2);
  });

  it('체력이 모자라면 시간이 빨라도 별 3이 아니다', () => {
    expect(win({ shrineHpRatio: 0.4, elapsed: 1 }).stars).toBe(1);
  });

  it('보스 스테이지 제한은 300초', () => {
    const boss = (elapsed: number) => evaluateStage({ victory: true, elapsed, shrineHpRatio: 1, stage: BOSS });
    expect(boss(300).stars).toBe(3);
    expect(boss(300.05).stars).toBe(2);
    expect(win({ elapsed: 250 }).stars).toBe(2); // 일반이면 250초는 초과
  });
});

describe('엽전', () => {
  it('일반: 30 + 10 x (장-1) + 별당 10', () => {
    expect(win({ shrineHpRatio: 0.1 }).yeopjeon).toBe(40); // 별 1
    expect(win({ elapsed: 300 }).yeopjeon).toBe(50); // 별 2
    expect(win().yeopjeon).toBe(60); // 별 3
    const ch3 = STAGES[10]; // 3-1
    expect(evaluateStage({ victory: true, elapsed: 1, shrineHpRatio: 1, stage: ch3 }).yeopjeon).toBe(30 + 20 + 30);
    const ch5 = STAGES[20];
    expect(evaluateStage({ victory: true, elapsed: 1, shrineHpRatio: 1, stage: ch5 }).yeopjeon).toBe(30 + 40 + 30);
  });

  it('보스: x1.5, 소수는 내림', () => {
    const boss = (stage: (typeof STAGES)[number], ratio: number) =>
      evaluateStage({ victory: true, elapsed: 1, shrineHpRatio: ratio, stage }).yeopjeon;
    expect(boss(STAGES[4], 1)).toBe(90); // (30+30) x 1.5
    expect(boss(STAGES[4], 0.1)).toBe(60); // (30+10) x 1.5
    expect(boss(STAGES[24], 1)).toBe(Math.floor((30 + 40 + 30) * 1.5));
  });

  it('모든 스테이지·별 조합에서 정수', () => {
    for (const s of STAGES) {
      for (const [elapsed, ratio] of [[1, 1], [999, 1], [999, 0.1]] as const) {
        const y = evaluateStage({ victory: true, elapsed, shrineHpRatio: ratio, stage: s }).yeopjeon;
        expect(Number.isInteger(y)).toBe(true);
      }
    }
  });
});

describe('신명', () => {
  it('이전 최고 별과의 차이만큼, 음수는 0', () => {
    expect(win({ previousBestStars: 0 }).sinmyeong).toBe(3);
    expect(win({ previousBestStars: undefined }).sinmyeong).toBe(3);
    expect(win({ previousBestStars: 1 }).sinmyeong).toBe(2);
    expect(win({ previousBestStars: 3 }).sinmyeong).toBe(0);
    expect(win({ previousBestStars: 3, shrineHpRatio: 0.1 }).sinmyeong).toBe(0);
  });
});

describe('Battle.stageResult', () => {
  it('진행 중이면 null, 끝나면 결과 계산', () => {
    const b = new Battle({ stage: 0, rng: new SeededRng(1) });
    expect(b.stageResult()).toBeNull();
    b.castle.takeDamage(1e9);
    b.step(0.05);
    const r = b.stageResult()!;
    expect(r.victory).toBe(true);
    expect(r.stars).toBe(3);
    expect(r.sinmyeong).toBe(3);
    expect(b.stageResult(3)!.sinmyeong).toBe(0);
  });

  it('서낭당이 부서지면 패배 결과', () => {
    const b = new Battle({ stage: 0, rng: new SeededRng(1) });
    b.shrine.takeDamage(1e9);
    b.step(0.05);
    expect(b.stageResult()!.stars).toBe(0);
  });
});
