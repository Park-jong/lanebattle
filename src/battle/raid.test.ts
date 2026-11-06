import { describe, expect, it } from 'vitest';
import { getEnemyDef } from '../data/enemies';
import { RAID_RULES, WAVE_RULES } from '../data/waves';
import { Battle } from './battle';
import { SeededRng } from './rng';
import { raidBudget, WaveDirector } from './wave';

const T = RAID_RULES.thresholds;
const setCastleRatio = (b: Battle, ratio: number) => { b.castle.hp = b.castle.maxHp * ratio; };
const cost = (reqs: { enemyId: string }[]) => reqs.reduce((s, r) => s + getEnemyDef(r.enemyId).waveScore, 0);

describe('성 체력 문턱 raid 발동', () => {
  it('문턱마다 이하로 내려갈 때 1회씩 발동한다', () => {
    const b = new Battle({ stage: 0 });
    expect(b.raidCount).toBe(0);
    T.forEach((th, i) => {
      setCastleRatio(b, th + 0.01);
      b.step(0.05);
      expect(b.raidCount).toBe(i);
      setCastleRatio(b, th);
      b.step(0.05);
      expect(b.raidCount).toBe(i + 1);
    });
  });

  it('한 번에 여러 문턱을 넘으면 모두 발동한다', () => {
    const b = new Battle({ stage: 0 });
    setCastleRatio(b, T[2] - 0.01);
    b.step(0.05);
    expect(b.raidCount).toBe(3);
  });

  it('같은 문턱은 다시 발동하지 않는다', () => {
    const b = new Battle({ stage: 0 });
    setCastleRatio(b, T[0] - 0.01);
    b.step(0.05);
    b.step(0.05);
    expect(b.raidCount).toBe(1);
    b.castle.hp = b.castle.maxHp; // 회복 후 다시 내려가도 재발동 없음
    b.step(0.05);
    setCastleRatio(b, T[0] - 0.01);
    b.step(0.05);
    expect(b.raidCount).toBe(1);
  });

  it('성이 파괴되어 승리하면 발동하지 않는다', () => {
    const b = new Battle({ stage: 0 });
    b.castle.hp = 0;
    b.step(0.05);
    expect(b.result).toBe('victory');
    expect(b.raidCount).toBe(0);
  });
});

describe('raid 예산·구성', () => {
  const d = (stage: number) => new WaveDirector(stage, new SeededRng(3));

  it('스테이지 번호가 커질수록 예산이 늘어난다', () => {
    for (let s = 1; s < 25; s++) expect(raidBudget(s, 2)).toBeGreaterThan(raidBudget(s - 1, 2));
  });

  it('raidIndex가 커질수록 예산이 늘어난다', () => {
    for (let i = 1; i < T.length; i++) expect(raidBudget(10, i)).toBeGreaterThan(raidBudget(10, i - 1));
  });

  it('예산 공식은 RAID_RULES를 따른다', () => {
    const { base, perStage, perRaid } = RAID_RULES.budget;
    expect(raidBudget(7, 3)).toBe(Math.round((base + perStage * 7) * (1 + perRaid * 3)));
  });

  it('구성 비용은 예산을 넘지 않는다', () => {
    for (let i = 0; i < T.length; i++) {
      const normal = d(10).composeRaid(i).filter((r) => !r.elite);
      expect(cost(normal)).toBeLessThanOrEqual(raidBudget(10, i));
    }
  });

  it('마지막 문턱 raid에만 정예가 포함된다', () => {
    for (let i = 0; i < T.length; i++) {
      const elites = d(5).composeRaid(i).filter((r) => r.elite);
      expect(elites).toHaveLength(i === T.length - 1 && RAID_RULES.eliteOnLast ? 1 : 0);
    }
  });
});

describe('raid 대기열', () => {
  it('raid 적이 기존 일반 대기 적보다 먼저 나온다', () => {
    const make = () => {
      const dir = new WaveDirector(0, new SeededRng(3));
      dir.update(100, 0); // 자리가 없어 일반 적이 대기열에 쌓인다
      return dir;
    };
    const dir = make();
    const before = dir.pendingCount;
    expect(before).toBeGreaterThan(0);
    const expected = make().composeRaid(0); // 같은 rng 상태에서 같은 구성
    dir.startRaid(0);
    expect(dir.raidCount).toBe(1);
    const out = [];
    for (let i = 0; i < expected.length * 40 && out.length < expected.length; i++) out.push(...dir.update(0.05));
    expect(out).toEqual(expected);
  });

  it('raid 적 사이 간격은 raid 간격, 일반 적은 일반 간격이다', () => {
    const dir = new WaveDirector(0, new SeededRng(3));
    dir.startRaid(0);
    const times: number[] = [];
    const dt = 0.05;
    let t = 0;
    for (let i = 0; i < 400 && dir.pendingCount > 0; i++) {
      t += dt;
      for (let k = dir.update(dt).length; k > 0; k--) times.push(t);
    }
    expect(times.length).toBeGreaterThan(2);
    expect(times[2] - times[1]).toBeCloseTo(RAID_RULES.spawnInterval, 1);
    expect(RAID_RULES.spawnInterval).toBeLessThan(WAVE_RULES.spawnInterval);
  });

  it('대기열은 최대 길이를 넘지 않고 정예는 버려지지 않는다', () => {
    const dir = new WaveDirector(24, new SeededRng(3));
    dir.update(0.01, 0);
    for (let i = 0; i < T.length; i++) dir.startRaid(i);
    expect(dir.pendingCount).toBeLessThanOrEqual(WAVE_RULES.maxQueue);
    const out = dir.update(0.01, Infinity);
    expect(out.length).toBeGreaterThan(0);
  });

  it('발동 직후 raid 적이 먼저 전장에 나온다', () => {
    const b = new Battle({ stage: 0 });
    setCastleRatio(b, T[0] - 0.01);
    b.step(0.05);
    expect(b.pendingSpawns).toBeGreaterThan(0);
    const total = b.pendingSpawns;
    b.step(2);
    expect(b.enemies.length).toBeGreaterThan(0);
    expect(b.pendingSpawns).toBeLessThan(total);
  });
});
