import { describe, expect, it } from 'vitest';
import { getEnemyDef } from '../data/enemies';
import { RAID_RULES, WAVE_RULES } from '../data/waves';
import { Battle } from './battle';
import { SeededRng } from './rng';
import { raidBudget, WaveDirector, type SpawnRequest } from './wave';

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

describe('raid 묶음 생산', () => {
  const G = RAID_RULES.groupSize;
  const GI = RAID_RULES.groupInterval;
  const dir = () => new WaveDirector(0, new SeededRng(3));
  const total = (i: number) => dir().composeRaid(i).length;

  it('발동 즉시 같은 update에서 첫 묶음이 동시에 나온다', () => {
    const d = dir();
    d.startRaid(0);
    const out = d.update(0.05);
    expect(total(0)).toBeGreaterThan(G);
    expect(out).toHaveLength(G);
    expect(d.raidPendingCount).toBe(total(0) - G);
  });

  it('raid 적은 일반 대기열에 들어가지 않는다', () => {
    const d = dir();
    d.startRaid(0);
    expect(d.pendingCount).toBe(0);
    expect(d.raidPendingCount).toBe(total(0));
  });

  it('간격마다 다음 묶음이 나오고 마지막 묶음은 나머지만 나온다', () => {
    const d = dir();
    d.startRaid(0);
    const expected = dir().composeRaid(0);
    const sizes: number[] = [];
    const all: SpawnRequest[] = [];
    const dt = 0.05;
    for (let t = 0; t < expected.length * GI + 3; t += dt) {
      const out = d.update(dt).filter((r) => r.groupIndex !== undefined); // 일반 웨이브 제외
      if (out.length > 0) { sizes.push(out.length); all.push(...out); }
    }
    const groups = Math.ceil(expected.length / G);
    expect(sizes).toHaveLength(groups);
    sizes.slice(0, -1).forEach((n) => expect(n).toBe(G));
    expect(sizes[groups - 1]).toBe(expected.length - G * (groups - 1));
    expect(all.map(({ enemyId, elite }) => ({ enemyId, elite }))).toEqual(expected);
  });

  it('묶음 사이 시간은 groupInterval이다', () => {
    const d = dir();
    d.startRaid(0);
    expect(d.update(0.05)).toHaveLength(G);
    let t = 0;
    let second = 0;
    while (second === 0 && t < GI * 3) { t += 0.05; second = d.update(0.05).length; }
    expect(second).toBeGreaterThan(0);
    expect(t).toBeGreaterThanOrEqual(GI - 0.05);
    expect(t).toBeLessThanOrEqual(GI + 0.1);
  });

  it('raid가 겹치면 순서대로 이어 붙어 같은 묶음 규칙으로 나온다', () => {
    const d = dir();
    d.startRaid(0);
    d.startRaid(1);
    const expected = [...dir().composeRaid(0), ...(() => { const x = dir(); x.composeRaid(0); return x.composeRaid(1); })()];
    expect(d.raidPendingCount).toBe(expected.length);
    expect(d.raidCount).toBe(2);
    const out = d.update(0.05);
    expect(out).toHaveLength(G);
  });

  it('일반 대기열은 raid와 상관없이 일반 간격을 유지한다', () => {
    const d = dir();
    d.update(100, 0); // 자리가 없어 일반 적이 쌓인다
    const pending = d.pendingCount;
    expect(pending).toBeGreaterThan(2);
    d.startRaid(0);
    expect(d.pendingCount).toBe(pending);
    const times: number[] = [];
    let t = 0;
    for (let i = 0; i < 400 && times.length < 3; i++) {
      t += 0.05;
      // 일반 적만 센다: raid 적은 groupIndex가 있다
      const normal = d.update(0.05).filter((r) => r.groupIndex === undefined);
      for (let k = normal.length; k > 0; k--) times.push(t);
    }
    expect(times[2] - times[1]).toBeCloseTo(WAVE_RULES.spawnInterval, 1);
  });

  it('일반 대기열은 최대 길이를 넘지 않고 raid 대기는 버리지 않는다', () => {
    const d = new WaveDirector(24, new SeededRng(3));
    d.update(0.01, 0);
    let sum = 0;
    for (let i = 0; i < T.length; i++) { sum += d.composeRaid(i).length; }
    const e = new WaveDirector(24, new SeededRng(3));
    e.update(0.01, 0);
    for (let i = 0; i < T.length; i++) e.startRaid(i);
    expect(e.pendingCount).toBeLessThanOrEqual(WAVE_RULES.maxQueue);
    expect(e.raidPendingCount).toBeGreaterThan(0);
    expect(sum).toBeGreaterThan(0);
  });

  it('자리가 모자라면 나올 수 있는 만큼만 나오고 나머지는 다음 묶음에 나온다', () => {
    const d = dir();
    d.startRaid(0);
    const n = total(0);
    const first = d.update(0.05, 2);
    expect(first).toHaveLength(2);
    expect(d.raidPendingCount).toBe(n - 2);
    expect(d.update(0.05, 100)).toHaveLength(0); // 아직 다음 묶음 시점 전
    let second = 0;
    for (let t = 0; t < GI * 2 && second === 0; t += 0.05) second = d.update(0.05, 100).length;
    expect(second).toBe(G);
  });

  it('한 틱에 raid와 일반을 합쳐 capacity를 넘지 않고 raid가 먼저 쓴다', () => {
    const d = dir();
    d.update(100, 0);
    d.startRaid(0);
    const out = d.update(0.05, 3);
    expect(out).toHaveLength(3);
    expect(out.every((r) => r.groupIndex !== undefined)).toBe(true);
  });

  it('마지막 raid의 정예는 버려지지 않고 끝내 나온다', () => {
    const d = new WaveDirector(5, new SeededRng(3));
    d.startRaid(T.length - 1);
    let elites = 0;
    for (let i = 0; i < 4000 && d.raidPendingCount > 0; i++) elites += d.update(0.05, 1).filter((r) => r.elite).length;
    expect(d.raidPendingCount).toBe(0);
    expect(elites).toBe(RAID_RULES.eliteOnLast ? 1 : 0);
  });
});

describe('raid 전장 반영', () => {
  it('발동 직후 첫 묶음이 전장에 나오고 x 위치가 서로 다르다', () => {
    const b = new Battle({ stage: 0 });
    b.step(0.01); // 일반 웨이브 전
    expect(b.enemies).toHaveLength(0);
    setCastleRatio(b, T[0] - 0.01);
    b.step(0.05); // 발동 후 다음 틱에 첫 묶음
    b.step(0.05);
    const xs = b.enemies.map((e) => e.x);
    expect(xs.length).toBe(RAID_RULES.groupSize);
    expect(new Set(xs).size).toBe(xs.length);
    const sorted = [...xs].sort((a, c) => c - a);
    // 스폰 직후 한 틱 이동이 있어 간격은 대략 groupSpreadX
    expect(sorted[0] - sorted[1]).toBeGreaterThan(RAID_RULES.groupSpreadX / 2);
  });

  it('남은 raid 적은 시간이 지나며 나온다', () => {
    const b = new Battle({ stage: 0 });
    setCastleRatio(b, T[0] - 0.01);
    b.step(0.05);
    const total = b.pendingSpawns;
    expect(total).toBeGreaterThan(0);
    b.step(2);
    expect(b.enemies.length).toBeGreaterThan(0);
    expect(b.pendingSpawns).toBeLessThan(total);
  });
});
