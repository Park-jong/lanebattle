import { describe, expect, it } from 'vitest';
import { getBossDef } from '../data/bosses';
import { COMBAT } from '../data/combat';
import { WAVE_RULES } from '../data/waves';
import { Battle } from './battle';
import { BossEncounter, type BossHost } from './boss';
import { createEnemy } from './enemyFactory';
import { Base, type Body, type Fighter } from './entities';
import { SeededRng } from './rng';
import { WaveDirector, type SpawnRequest } from './wave';

const director = (stage = 0) => new WaveDirector(stage, new SeededRng(5));

/** dt 간격으로 seconds만큼 진행하며 (시각, 요청)을 모은다 */
function run(d: WaveDirector, from: number, seconds: number, capacity: number, dt = 0.05) {
  const out: { t: number; req: SpawnRequest }[] = [];
  const n = Math.round(seconds / dt);
  for (let i = 1; i <= n; i++) {
    const t = from + i * dt;
    for (const req of d.update(dt, capacity)) out.push({ t, req });
  }
  return out;
}

describe('적 상한 데이터', () => {
  it('상한 60, 대기열 최대 60', () => {
    expect(COMBAT.maxEnemies).toBe(60);
    expect(WAVE_RULES.maxQueue).toBe(60);
  });
});

describe('웨이브 대기열', () => {
  it('자리가 없으면 아무도 나오지 않고 대기열에 쌓인다', () => {
    const d = director();
    expect(run(d, 0, 30, 0)).toHaveLength(0);
    expect(d.pendingCount).toBeGreaterThan(0);
  });

  it('대기열은 최대 길이를 넘지 않고 넘치는 적은 버린다', () => {
    const d = director(24);
    run(d, 0, 600, 0);
    expect(d.pendingCount).toBe(WAVE_RULES.maxQueue);
  });

  it('자리가 나면 쌓인 적이 0.8초 간격으로 한 마리씩 나온다', () => {
    const d = director();
    run(d, 0, 40, 0);
    const queued = d.pendingCount;
    expect(queued).toBeGreaterThan(7);
    const out = run(d, 40, 4.4, Infinity); // 다음 웨이브(45초) 전까지
    expect(out.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < out.length; i++) {
      const gap = out[i].t - out[i - 1].t;
      expect(gap).toBeGreaterThan(0.8 - 0.06);
      expect(gap).toBeLessThan(0.8 + 0.06);
    }
  });

  it('한 번에 나오는 수는 남은 자리를 넘지 않는다', () => {
    const d = director();
    run(d, 0, 40, 0);
    expect(d.update(10, 2).length).toBe(2);
    expect(d.update(10, 1).length).toBe(1);
  });

  it('정예도 대기열을 거쳐 자리가 나야 나온다', () => {
    const d = director(0);
    run(d, 0, 164, Infinity); // 웨이브 0~7을 모두 비움
    expect(run(d, 164, 20, 0)).toHaveLength(0); // 9번째 웨이브(165초)는 자리가 없어 대기
    const out = run(d, 184, 60, Infinity);
    expect(out.filter((o) => o.req.elite)).toHaveLength(1);
  });

  it('대기열이 가득 차 있어도 정예는 들어간다', () => {
    const d = director(23); // 일반 스테이지 4-4
    run(d, 0, 164, 0); // 웨이브 0~7로 대기열 가득
    expect(d.pendingCount).toBe(WAVE_RULES.maxQueue);
    run(d, 164, 2, 0); // 9번째 웨이브 도착
    expect(d.pendingCount).toBe(WAVE_RULES.maxQueue);
    const out = run(d, 166, 200, Infinity);
    expect(out.filter((o) => o.req.elite)).toHaveLength(1);
  });
});

describe('Battle 적 상한', () => {
  const fill = (b: Battle, n: number) => {
    for (let i = 0; i < n; i++) b.spawnEnemy('eggGhost', false, 2000 + i);
  };

  it('60마리에서 더 나오지 않고 웨이브는 대기한다', () => {
    const b = new Battle({ stage: 0, rng: new SeededRng(1) });
    fill(b, 60);
    for (let i = 0; i < 40; i++) {
      b.step(1);
      expect(b.enemyCount).toBeLessThanOrEqual(60);
    }
    expect(b.enemyCount).toBe(60);
    expect(b.pendingSpawns).toBeGreaterThan(0);
    expect(b.freeEnemySlots).toBe(0);
  });

  it('자리가 나면 대기하던 적이 나온다', () => {
    const b = new Battle({ stage: 0, rng: new SeededRng(1) });
    fill(b, 60);
    b.step(20);
    const pending = b.pendingSpawns;
    for (const e of b.enemies.slice(0, 3)) e.takeDamage(1e9);
    b.step(2.5);
    expect(b.pendingSpawns).toBeLessThan(pending);
    expect(b.enemyCount).toBeLessThanOrEqual(60);
  });

  it('보스는 상한에서 제외된다', () => {
    const b = new Battle({ stage: 4, rng: new SeededRng(1), bossAt: 0 });
    fill(b, 60);
    b.step(0.1);
    expect(b.encounter!.boss).not.toBeNull();
    expect(b.enemies).toHaveLength(61);
    expect(b.enemyCount).toBe(60);
  });

  it('상한이 가득 차면 거대 원귀의 졸개 소환이 생략된다', () => {
    const b = new Battle({ stage: 4, rng: new SeededRng(1), bossAt: 0 });
    fill(b, 60);
    b.step(9.5);
    const before = b.enemies.length;
    b.step(1.5); // 10초 소환 시점 통과
    expect(b.enemies.length).toBe(before);
  });
});

/** 졸개 소환 일부 생략 검증용 가짜 전장 */
class StubHost implements BossHost {
  allies: Fighter[] = [];
  enemies: Fighter[] = [];
  livingHero: Body | null = null;
  shrine = new Base('ally', 80, 1000, 50, 90);
  castle = new Base('enemy', 2320, 1200, 70, 130);
  freeEnemySlots = 2;
  addEnemy(e: Fighter): void {
    this.enemies.push(e);
  }
  spawnEnemy(id: string, elite: boolean, x: number): Fighter {
    const e = createEnemy(id, 4, elite, x);
    this.enemies.push(e);
    return e;
  }
  dealFixedDamage(): void {}
  knockback(): void {}
  dispelBuffs(): void {}
  setAllyBonusesSuppressed(): void {}
  setTalismanChargeFactor(): void {}
}

describe('졸개 소환 일부 생략', () => {
  it('남은 자리(2)만큼만 소환한다', () => {
    const host = new StubHost();
    const enc = new BossEncounter(getBossDef(1), host, 0);
    let t = 0;
    for (let i = 0; i < Math.round(10.1 / 0.05); i++) {
      t += 0.05;
      enc.update(t, 0.05);
    }
    // 보스 1 + 졸개 2 (5마리 중 자리만큼)
    expect(host.enemies).toHaveLength(3);
  });
});
