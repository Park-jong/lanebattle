import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAllyDef } from '../data/allies';
import { Battle } from './battle';
import { SeededRng } from './rng';
import { WaveDirector, waveBudget, waveFormation } from './wave';
import { getEnemyDef } from '../data/enemies';

afterEach(() => vi.restoreAllMocks());

function arena(stage = 0): Battle {
  vi.spyOn(WaveDirector.prototype, 'update').mockReturnValue([]);
  const b = new Battle({ stage, rng: new SeededRng(1) });
  b.hero.x = 80;
  return b;
}

function army(b: Battle, units: [string, number][], x = 1000): number {
  let cost = 0;
  for (const [id, count] of units) {
    b.spawnFreeAllies(id, count);
    cost += getAllyDef(id).cost * count;
  }
  b.allies.forEach((a, i) => { a.x = x - i * 4; });
  return cost;
}

describe('동일 예산 전투: 병종 선택의 가치', () => {
  it('구미호와 전열 조합은 같은 비용의 방망이병보다 무리를 빠르게 정리한다', () => {
    const fight = (units: [string, number][]) => {
      const b = arena();
      const cost = army(b, units);
      for (let i = 0; i < 16; i++) b.spawnEnemy('eggGhost', false, 1190 + i * 5);
      b.step(12);
      return { cost, kills: 16 - b.enemies.length, survivors: b.allies.length };
    };
    const cheap = fight([['clubGoblin', 6]]);
    const combined = fight([['clubGoblin', 2], ['gumiho', 1]]);
    expect(combined.cost).toBe(cheap.cost);
    expect(combined.kills).toBeGreaterThan(cheap.kills);
    expect(combined.survivors).toBeGreaterThan(0);
  });

  it('불가사리는 같은 예산의 물량보다 장갑 전열을 잘 돌파한다', () => {
    const fight = (units: [string, number][]) => {
      const b = arena(5);
      const cost = army(b, units);
      for (let i = 0; i < 3; i++) b.spawnEnemy('jangseungSpirit', false, 1120 + i * 8);
      b.step(25);
      return { cost, enemyHp: b.enemies.reduce((n, e) => n + e.hp, 0), survivors: b.allies.length };
    };
    const cheap = fight([['clubGoblin', 11]]);
    const heavy = fight([['bulgasari', 3]]);
    expect(heavy.cost).toBe(cheap.cost);
    expect(heavy.enemyHp).toBeLessThan(cheap.enemyHp);
    expect(heavy.survivors).toBeGreaterThan(0);
  });

  it('저코스트 병력은 초반 소규모 교전에 계속 유효하다', () => {
    const b = arena();
    army(b, [['clubGoblin', 2]]);
    b.spawnEnemy('eggGhost', false, 1100);
    b.spawnEnemy('eggGhost', false, 1120);
    b.step(10);
    expect(b.enemies).toHaveLength(0);
    expect(b.allies.length).toBeGreaterThan(0);
  });
});

describe('밀집 병력 대응과 지원 병종', () => {
  it('장승의 휩쓸기는 주 대상이 죽어도 주변 지상 병력을 때리고 비행·먼 대상·기지는 제외한다', () => {
    const b = arena();
    army(b, [['clubGoblin', 3], ['magpieFlock', 1]]);
    const [main, near, far, air] = b.allies;
    main.x = 1000; main.hp = 1;
    near.x = 990; far.x = 850; air.x = 1000;
    for (const a of b.allies) a.status!.stun(100, false);
    b.spawnEnemy('jangseungSpirit', false, 1010);
    b.step(0.05);
    expect(main.alive).toBe(false);
    expect(near.hp).toBe(near.maxHp - 20 * 0.75);
    expect(far.hp).toBe(far.maxHp);
    expect(air.hp).toBe(air.maxHp);
    expect(b.shrine.hp).toBe(b.shrine.maxHp);
  });

  it('투척병의 범위 투사체는 밀집한 비행 병력도 위협한다', () => {
    const b = arena();
    army(b, [['magpieFlock', 3]]);
    b.allies[2].x = 850;
    for (const a of b.allies) a.status!.stun(100, false);
    const near = [...b.allies];
    b.spawnEnemy('waterGhostThrower', false, 1100);
    b.step(0.5);
    expect(near[0].hp).toBe(near[0].maxHp - 9);
    expect(near[1].hp).toBe(near[1].maxHp - 9);
    expect(near[2].hp).toBe(near[2].maxHp);
    expect(near[1].status!.slowed).toBe(true);
  });

  it('해태의 방호는 버프 해제 중에도 유지된다', () => {
    const b = arena();
    army(b, [['haetae', 1]]);
    const tank = b.allies[0];
    tank.status!.stun(100, false);
    b.dispelBuffs(tank, 10);
    b.spawnEnemy('eggGhost', false, 1010);
    b.step(0.05);
    expect(tank.hp).toBeCloseTo(tank.maxHp - 9 * 0.8);
  });

  it('삼족오는 두 대상을 쏘고 같은 병종의 오라는 중첩되지 않는다', () => {
    const b = arena();
    army(b, [['samjokgo', 2], ['yeongdeungWind', 2], ['clubGoblin', 1]]);
    const target = b.allies[4];
    b.spawnEnemy('eggGhost', false, 1150);
    b.spawnEnemy('eggGhost', false, 1160);
    b.step(0.05);
    expect(target.status!.attackBonus).toBeCloseTo(0.2);
    expect(target.status!.attackSpeedBonus).toBeCloseTo(0.15);
    expect(b.projectiles.filter((p) => p.payload.attacker === b.allies[0])).toHaveLength(2);
  });
});

describe('공세 예고', () => {
  it('표시를 읽어도 난수나 구성이 바뀌지 않고 카운트다운은 실제 공세에 맞는다', () => {
    const d = new WaveDirector(5, new SeededRng(7));
    expect(d.nextWave).toMatchObject({ number: 1, seconds: 5, label: '무리 공세' });
    const control = new WaveDirector(5, new SeededRng(7));
    for (let i = 0; i < 10; i++) void d.nextWave;
    expect(d.update(5)).toEqual(control.update(5));
    expect(d.nextWave).toMatchObject({ number: 2, seconds: 20, label: '장갑 돌파' });
  });

  it('전 스테이지에서 예고한 중심 병종이 실제 공세에 포함되고 예산을 지킨다', () => {
    for (let stage = 0; stage < 25; stage++) {
      const d = new WaveDirector(stage, new SeededRng(stage + 1));
      for (let wave = 0; wave < 12; wave++) {
        const units = d.composeWave(wave).filter((s) => !s.elite);
        expect(units.some((s) => s.enemyId === waveFormation(stage, wave).enemyId)).toBe(true);
        expect(units.reduce((n, s) => n + getEnemyDef(s.enemyId).waveScore, 0))
          .toBeLessThanOrEqual(waveBudget(stage, Math.min(8, wave)));
      }
    }
    expect(waveFormation(7, 2).label).toBe('공중 습격');
  });
});
